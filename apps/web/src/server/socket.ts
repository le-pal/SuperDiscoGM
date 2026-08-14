import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { getUserByToken, SESSION_COOKIE } from "./auth";

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

    socket.on("chat:message", (payload: ChatMessagePayload) => {
      const { partyId, visibleToUserIds } = payload;

      if (!visibleToUserIds || visibleToUserIds.length === 0) {
        io.to(partyRoom(partyId)).emit("chat:message", payload);
        return;
      }

      // Aparté privé [Q26] : émission ciblée, pas de broadcast à la table.
      for (const uid of visibleToUserIds) {
        io.to(userRoom(uid)).emit("chat:message", payload);
      }
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
