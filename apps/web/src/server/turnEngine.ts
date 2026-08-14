import type { Server as SocketIOServer } from "socket.io";
import { streamText, stepCountIs, type ModelMessage } from "ai";
import { prisma } from "@superdiscogm/db";
import { getConfiguredModel, buildGameTools } from "@superdiscogm/llm";
import { assembleTurnContext } from "./turnContext";
import { entityMemoryQueue, summaryConsolidationQueue } from "./queue";

// Moteur de tour MJ côté serveur (étape 35) : persistance des messages en DB — jusqu'ici
// socket.ts ne faisait qu'un relais temps réel sans écrire en base — puis génération streamée
// de la réponse du MJ-IA à partir du contexte assemblé (étape 30) et des tool-calls
// déterministes (étapes 26/31/34). Reste synchrone/streamé depuis apps/web, jamais via les
// queues BullMQ (réservées à l'asynchrone explicite de la spec, cf packages/jobs).

function partyRoom(partyId: string) {
  return `party:${partyId}`;
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

  const model = await getConfiguredModel();
  const tools = buildGameTools({ campaignId: party.campaignId, partyId });

  const result = streamText({ model, system, messages, tools, stopWhen: stepCountIs(5) });

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

  // Transition de phase [Q17] : advance_phase (étape 34) mute déjà l'état, il ne manque que
  // l'annonce visible en chat (repère SYSTEM), seule chose que le tool lui-même ne peut pas faire
  // puisqu'il n'a pas accès à la room Socket.IO.
  const toolResults = await result.toolResults;
  const phaseTransition = toolResults.find((r) => r.toolName === "advance_phase");
  const phaseOutput = phaseTransition?.output as
    | { advanced: boolean; newPhase?: { id: string; title: string } }
    | undefined;
  if (phaseOutput?.advanced) {
    const sysMessage = await prisma.message.create({
      data: {
        partyId,
        authorType: "SYSTEM",
        content: `La partie avance : ${phaseOutput.newPhase?.title ?? "phase suivante"}.`,
        visibleToUserIds: [],
      },
    });
    io.to(partyRoom(partyId)).emit("chat:message", {
      partyId,
      authorType: "SYSTEM",
      content: sysMessage.content,
      visibleToUserIds: [],
      id: sysMessage.id,
      createdAt: sysMessage.createdAt,
    });
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
