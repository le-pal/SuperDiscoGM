import type { Server as SocketIOServer } from "socket.io";
import { tool, streamText, stepCountIs, type ModelMessage } from "ai";
import { z } from "zod";
import { prisma } from "@superdiscogm/db";
import { getConfiguredModelInfo, buildGameTools, recordUsage, buildProviderOptions } from "@superdiscogm/llm";
import { assembleTurnContext } from "./turnContext";
import { entityMemoryQueue, summaryConsolidationQueue } from "./queue";
import type { ChatMessagePayload } from "./socket";

// Moteur de tour MJ côté serveur (étape 35) : persistance des messages en DB — jusqu'ici
// socket.ts ne faisait qu'un relais temps réel sans écrire en base — puis génération streamée
// de la réponse du MJ-IA à partir du contexte assemblé (étape 30) et des tool-calls
// déterministes (étapes 26/31/34). Reste synchrone/streamé depuis apps/web, jamais via les
// queues BullMQ (réservées à l'asynchrone explicite de la spec, cf packages/jobs).

function partyRoom(partyId: string) {
  return `party:${partyId}`;
}

async function emitAndPersistSystemMessage(io: SocketIOServer, partyId: string, content: string) {
  const message = await prisma.message.create({
    data: { partyId, authorType: "SYSTEM", content, visibleToUserIds: [] },
  });
  io.to(partyRoom(partyId)).emit("chat:message", {
    partyId,
    authorType: "SYSTEM",
    content,
    visibleToUserIds: [],
    id: message.id,
    createdAt: message.createdAt,
  } satisfies ChatMessagePayload);
  return message;
}

export async function persistPlayerMessage(params: {
  partyId: string;
  authorUserId: string;
  content: string;
  visibleToUserIds?: string[];
}) {
  return prisma.message.create({
    data: {
      partyId: params.partyId,
      authorType: "PLAYER",
      authorUserId: params.authorUserId,
      content: params.content,
      visibleToUserIds: params.visibleToUserIds ?? [],
    },
  });
}

// Party split [Q26][Q26b] : dès qu'un message vise un sous-ensemble de la table (nouveau
// périmètre, différent de l'aparté déjà en cours le cas échéant), on émet un repère SYSTEM
// visible de tous — signale qu'un aparté a lieu SANS révéler son contenu — et on mémorise le
// périmètre sur la Party pour permettre le reveal manuel plus tard (createRevealHuddleTool).
// Ne fait rien pour un message public (visibleToUserIds vide) ni pour la continuation d'un
// aparté déjà annoncé avec exactement le même périmètre (évite de spammer un repère par message).
export async function announcePartySplitIfNeeded(
  io: SocketIOServer,
  partyId: string,
  visibleToUserIds: string[] | undefined
): Promise<void> {
  const scope = [...(visibleToUserIds ?? [])].sort();
  if (scope.length === 0) return;

  const party = await prisma.party.findUniqueOrThrow({ where: { id: partyId } });
  const current = [...party.partySplitUserIds].sort();
  const sameScope = scope.length === current.length && scope.every((id, i) => id === current[i]);
  if (sameScope) return;

  const participants = await prisma.user.findMany({ where: { id: { in: scope } }, select: { name: true } });
  await prisma.party.update({
    where: { id: partyId },
    data: { partySplitUserIds: scope, partySplitStartedAt: new Date() },
  });

  const names = participants.map((p) => p.name).join(" et ") || "certains joueurs";
  await emitAndPersistSystemMessage(
    io,
    partyId,
    `Le MJ s'isole avec ${names} — un aparté est en cours, son contenu reste privé jusqu'au reveal.`
  );
}

// Reveal manuel [Q26b] : décision du MJ-IA seul (tool-call), jamais un bouton joueur. Rend
// visibles à toute la table les messages de l'aparté en cours (bascule visibleToUserIds -> []
// en DB + rediffusion en direct pour les clients déjà connectés) et referme le périmètre.
function createRevealHuddleTool(io: SocketIOServer, partyId: string) {
  return tool({
    description:
      "Révèle à toute la table le contenu de l'aparté privé en cours. À utiliser uniquement quand le MJ-IA décide que ce qui s'est dit en privé doit maintenant être connu de tous.",
    inputSchema: z.object({}),
    execute: async () => {
      const party = await prisma.party.findUniqueOrThrow({ where: { id: partyId } });
      if (party.partySplitUserIds.length === 0) {
        return { revealed: false, message: "Aucun aparté en cours." };
      }

      const hidden = await prisma.message.findMany({
        where: {
          partyId,
          visibleToUserIds: { isEmpty: false },
          createdAt: { gte: party.partySplitStartedAt ?? new Date(0) },
        },
        orderBy: { createdAt: "asc" },
      });

      await prisma.message.updateMany({
        where: { id: { in: hidden.map((m) => m.id) } },
        data: { visibleToUserIds: [] },
      });
      await prisma.party.update({
        where: { id: partyId },
        data: { partySplitUserIds: [], partySplitStartedAt: null },
      });

      for (const m of hidden) {
        io.to(partyRoom(partyId)).emit("chat:message", {
          partyId,
          authorType: m.authorType,
          authorUserId: m.authorUserId ?? undefined,
          content: m.content,
          visibleToUserIds: [],
          id: m.id,
          createdAt: m.createdAt,
        } satisfies ChatMessagePayload);
      }
      await emitAndPersistSystemMessage(io, partyId, "Le MJ révèle le contenu de l'aparté à toute la table.");

      return { revealed: true, messageCount: hidden.length };
    },
  });
}

export async function runMjTurn(
  io: SocketIOServer,
  partyId: string,
  triggeringMessageId: string,
  visibleToUserIds: string[] = []
): Promise<void> {
  const party = await prisma.party.findUniqueOrThrow({ where: { id: partyId } });
  const context = await assembleTurnContext(partyId);

  // Rappel des fiches de la table dans le prompt : le MJ-IA a besoin de characterSheetId pour
  // appeler les outils de fiche (étape 26) sans les inventer.
  const sheets = await prisma.characterSheet.findMany({
    where: { campaignId: party.campaignId },
    include: { user: { select: { name: true } } },
  });
  const sheetsBlock = sheets.length
    ? sheets
        .map(
          (s) =>
            `- ${s.user.name} joue ${s.name} (characterSheetId: ${s.id}, PV ${s.hp}/${s.hpMax}, niveau ${s.level})`
        )
        .join("\n")
    : "(aucune fiche de personnage créée pour l'instant)";

  const system = [
    context.systemPrompt,
    `## Scénario\n${context.scenarioDigest}`,
    `## Résumé\n${context.partySummary}`,
    `## Entités pertinentes à la scène\n${context.relevantEntities}`,
    `## Personnages de la table\n${sheetsBlock}`,
  ].join("\n\n");

  const messages: ModelMessage[] = context.recentMessages.map((m) => ({
    role: m.authorType === "PLAYER" ? "user" : "assistant",
    content: m.authorName ? `[${m.authorName}] ${m.content}` : m.content,
  }));

  const { model, provider, modelName } = await getConfiguredModelInfo();
  const tools = {
    ...buildGameTools({ campaignId: party.campaignId, partyId }),
    reveal_huddle: createRevealHuddleTool(io, partyId),
  };

  const result = streamText({
    model,
    system,
    messages,
    tools,
    stopWhen: stepCountIs(5),
    providerOptions: buildProviderOptions(provider),
  });

  let fullText = "";
  for await (const chunk of result.textStream) {
    fullText += chunk;
    io.to(partyRoom(partyId)).emit("chat:stream", { partyId, chunk });
  }

  let lastMessageId = triggeringMessageId; // borne de fin pour l'extraction de mémoire ci-dessous
  if (fullText.trim().length > 0) {
    const mjMessage = await prisma.message.create({
      data: { partyId, authorType: "MJ", content: fullText, visibleToUserIds },
    });
    lastMessageId = mjMessage.id;

    io.to(partyRoom(partyId)).emit("chat:message", {
      partyId,
      authorType: "MJ",
      content: fullText,
      visibleToUserIds,
      id: mjMessage.id,
      createdAt: mjMessage.createdAt,
    });
  }

  // Suivi de budget/coût [Q03] (étape 48) — journalisé après consommation du stream, jamais
  // bloquant pour la réponse déjà envoyée au joueur si l'écriture échoue.
  const usage = await result.usage;
  await recordUsage({ provider, model: modelName, usage, source: "turn_engine" }).catch((err) => {
    console.error("[usage] échec de journalisation (turn_engine) :", err);
  });

  // Transition de phase [Q17] : advance_phase (étape 34) mute déjà l'état, il ne manque que
  // l'annonce visible en chat (repère SYSTEM), seule chose que le tool lui-même ne peut pas faire
  // puisqu'il n'a pas accès à la room Socket.IO.
  const toolResults = await result.toolResults;
  const phaseTransition = toolResults.find((r) => r.toolName === "advance_phase");
  const phaseOutput = phaseTransition?.output as
    | { advanced: boolean; newPhase?: { id: string; title: string } }
    | undefined;
  if (phaseOutput?.advanced) {
    await emitAndPersistSystemMessage(
      io,
      partyId,
      `La partie avance : ${phaseOutput.newPhase?.title ?? "phase suivante"}.`
    );
  }

  // Mémoire continue [Q20][Q21] : un agent dédié met à jour résumé + journal d'entités après
  // chaque échange significatif. V1 : on déclenche systématiquement après chaque tour MJ plutôt
  // que de construire un juge de "significativité" séparé — hypothèse pragmatique, cohérente
  // avec l'échelle visée (usage perso / petit groupe) [Q40].
  await entityMemoryQueue.add("extract", {
    campaignId: party.campaignId,
    partyId,
    fromMessageId: triggeringMessageId,
    toMessageId: lastMessageId,
  });
  await summaryConsolidationQueue.add("consolidate-session", {
    level: "SESSION",
    campaignId: party.campaignId,
    partyId,
  });
}
