import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { prisma } from "@superdiscogm/db";
import { rollDice } from "@superdiscogm/llm";
import { getUserByToken, SESSION_COOKIE } from "./session";
import { persistPlayerMessage, runMjTurn, announcePartySplitIfNeeded } from "./turnEngine";

// Action structurée clé [Q27] : /roll <formule>, ex "/roll 1d20+3". Jet non sollicité par le
// MJ — libre au MJ-IA de l'ignorer ou d'en tenir compte selon le contexte [Q32c]. Les autres
// raccourcis évoqués par Q27 (sélection de sort/objet) sont des contrôles cliquables, donc
// portés par l'écran de partie (étape 41) plutôt que par ce parsing texte.
const ROLL_COMMAND_PATTERN = /^\/roll\s+(\S+)\s*$/i;

// Événements du chat de partie. La confidentialité d'un message "party split" [Q26]
// est appliquée ICI, côté serveur, en n'émettant que vers les rooms des destinataires
// autorisés — jamais en diffusant tout puis en filtrant côté client (ce que fait la
// maquette statique pour la démo, mais qui laisserait fuiter le contenu sur le réseau).

export interface ChatMessagePayload {
  partyId: string;
  authorType: "PLAYER" | "MJ" | "SYSTEM";
  authorUserId?: string;
  content: string;
  /** Vide = visible de toute la table. Sinon, liste des userId autorisés (+ MJ implicite). */
  visibleToUserIds?: string[];
  /** Absents pour un message optimiste émis avant confirmation DB — renseignés après persistance (étape 35). */
  id?: string;
  createdAt?: Date;
}

function partyRoom(partyId: string) {
  return `party:${partyId}`;
}

function userRoom(userId: string) {
  return `user:${userId}`;
}

function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  const found = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : undefined;
}

function partyPresenceRoom(io: SocketIOServer, partyId: string): string[] {
  const room = io.sockets.adapter.rooms.get(partyRoom(partyId));
  if (!room) return [];
  const userIds = new Set<string>();
  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    const userId = socket?.data.userId as string | undefined;
    if (userId) userIds.add(userId);
  }
  return [...userIds];
}

export function createSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    path: "/socket.io",
  });

  // Vérifie la session AVANT d'accepter la connexion (pas de confiance dans un userId
  // envoyé librement par le client) — même mécanisme que getCurrentUser() côté HTTP,
  // via le cookie de session porté par le navigateur au handshake WebSocket.
  io.use(async (socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie;
    const token = parseCookie(cookieHeader, SESSION_COOKIE);
    const user = token ? await getUserByToken(token) : null;

    if (!user) {
      next(new Error("unauthorized"));
      return;
    }

    socket.data.userId = user.id;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string;
    socket.join(userRoom(userId));

    socket.on("party:join", (partyId: string) => {
      socket.join(partyRoom(partyId));
      io.to(partyRoom(partyId)).emit("party:presence", {
        partyId,
        onlineUserIds: partyPresenceRoom(io, partyId),
      });
    });

    socket.on("party:leave", (partyId: string) => {
      socket.leave(partyRoom(partyId));
      io.to(partyRoom(partyId)).emit("party:presence", {
        partyId,
        onlineUserIds: partyPresenceRoom(io, partyId),
      });
    });

    // Indicateur de présence du tableau de bord [Q49][Q49b] : lecture ponctuelle (ack, pas de
    // flux poussé dédié) de qui est connecté sur une liste de parties, SANS rejoindre ces rooms —
    // rejoindre marquerait à tort le visiteur du dashboard comme "présent" dans une partie qu'il
    // ne fait que survoler depuis la liste.
    socket.on("dashboard:presence", (partyIds: unknown, ack: unknown) => {
      if (!Array.isArray(partyIds) || typeof ack !== "function") return;
      const result: Record<string, string[]> = {};
      for (const partyId of partyIds) {
        if (typeof partyId === "string") result[partyId] = partyPresenceRoom(io, partyId);
      }
      (ack as (result: Record<string, string[]>) => void)(result);
    });

    // Seuls les messages JOUEUR entrent par ce canal client — le MJ-IA et les repères SYSTEM
    // (transition de phase...) sont émis directement par le moteur de tour (turnEngine.ts, étape
    // 35), jamais relayés depuis un payload client (authorType/authorUserId y seraient
    // spoofables). authorUserId vient toujours de la session vérifiée au handshake, jamais du payload.
    socket.on("chat:message", async (payload: Pick<ChatMessagePayload, "partyId" | "content" | "visibleToUserIds">) => {
      const { partyId } = payload;
      let content = payload.content;
      if (typeof content !== "string" || content.trim().length === 0) return;

      const rollMatch = content.trim().match(ROLL_COMMAND_PATTERN);
      if (rollMatch) {
        let roll;
        try {
          roll = rollDice(rollMatch[1]);
        } catch {
          socket.emit("chat:error", { message: `Formule de dé invalide : "${rollMatch[1]}" (attendu NdM ou NdM+K, ex: 1d20, 2d6+1).` });
          return;
        }
        await prisma.diceRoll.create({
          // Cast ciblé même raison que characterSheet.ts : Prisma exige InputJsonValue (union
          // stricte) pour les colonnes Json, notre DiceRollResult typé le satisfait à l'exécution.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: { partyId, rolledByUserId: userId, formula: roll.formula, result: roll as any, requestedByMj: false },
        });
        const modifierText = roll.modifier ? (roll.modifier > 0 ? ` +${roll.modifier}` : ` ${roll.modifier}`) : "";
        content = `🎲 ${roll.formula} → [${roll.rolls.join(", ")}]${modifierText} = ${roll.total}`;
      }

      // L'auteur doit toujours pouvoir relire son propre message — un aparté qui l'exclurait de
      // sa propre conversation privée serait un bug, pas une fonctionnalité de confidentialité.
      const visibleToUserIds =
        payload.visibleToUserIds && payload.visibleToUserIds.length > 0
          ? [...new Set([...payload.visibleToUserIds, userId])]
          : undefined;

      const saved = await persistPlayerMessage({ partyId, authorUserId: userId, content, visibleToUserIds });
      const outgoing: ChatMessagePayload = {
        partyId,
        authorType: "PLAYER",
        authorUserId: userId,
        content,
        visibleToUserIds,
        id: saved.id,
        createdAt: saved.createdAt,
      };

      if (!visibleToUserIds) {
        io.to(partyRoom(partyId)).emit("chat:message", outgoing);
      } else {
        // Aparté privé [Q26] : émission ciblée, pas de broadcast à la table.
        for (const uid of visibleToUserIds) {
          io.to(userRoom(uid)).emit("chat:message", outgoing);
        }
        await announcePartySplitIfNeeded(io, partyId, visibleToUserIds);
      }

      runMjTurn(io, partyId, saved.id, visibleToUserIds ?? []).catch((err) => {
        console.error(`[turnEngine] échec du tour MJ pour la partie ${partyId} :`, err);
      });
    });

    socket.on("disconnect", () => {
      for (const room of socket.rooms) {
        if (room.startsWith("party:")) {
          io.to(room).emit("party:presence", {
            partyId: room.slice("party:".length),
            onlineUserIds: partyPresenceRoom(io, room.slice("party:".length)),
          });
        }
      }
    });
  });

  return io;
}
