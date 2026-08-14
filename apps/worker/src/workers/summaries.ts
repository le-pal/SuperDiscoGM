import type { Job } from "bullmq";
import { generateText } from "ai";
import { prisma } from "@superdiscogm/db";
import { getConfiguredModel } from "@superdiscogm/llm";
import type { SummaryConsolidationJob } from "@superdiscogm/jobs";

// Hiérarchie de résumés à 3 niveaux [Q22] : session -> arc/scénario -> campagne.
// Évite que le résumé lui-même redevienne le problème de contexte sur une longue campagne.
// SESSION condense les messages bruts d'une partie ; ARC condense les résumés SESSION des
// parties jouées sur un scénario donné ; CAMPAIGN condense les résumés ARC de la campagne.
export async function processSummaryConsolidation(job: Job<SummaryConsolidationJob>) {
  const { level, campaignId, partyId, scenarioId } = job.data;

  if (level === "SESSION" && !partyId) {
    throw new Error("partyId requis pour un résumé de niveau SESSION");
  }
  if (level === "ARC" && !scenarioId) {
    throw new Error("scenarioId requis pour un résumé de niveau ARC");
  }

  let sourceText: string;

  if (level === "SESSION") {
    const messages = await prisma.message.findMany({
      where: { partyId: partyId! },
      orderBy: { createdAt: "asc" },
    });
    sourceText = messages.map((m) => `[${m.authorType}] ${m.content}`).join("\n");
  } else if (level === "ARC") {
    const childSummaries = await prisma.summary.findMany({
      where: { level: "SESSION", campaignId, party: { scenarioId: scenarioId! } },
    });
    sourceText = childSummaries.map((s) => s.content).join("\n\n");
  } else {
    const childSummaries = await prisma.summary.findMany({
      where: { level: "ARC", campaignId },
    });
    sourceText = childSummaries.map((s) => s.content).join("\n\n");
  }

  if (sourceText.trim().length === 0) return; // rien à consolider pour l'instant

  const model = await getConfiguredModel();
  const { text: content } = await generateText({
    model,
    prompt:
      `Condense ce${level === "SESSION" ? " fil de messages de partie" : "s résumés"} de jeu de rôle ` +
      "en un résumé fidèle et concis, qui garde les décisions et événements importants pour qu'un " +
      "Maître du Jeu puisse reprendre la partie sans relire le détail brut.\n\n" +
      `Niveau : ${level}\n\n${sourceText}`,
  });

  // findFirst + create/update plutôt qu'un upsert sur clé composite : partyId/scenarioId sont
  // nullables selon le niveau, et NULL n'est pas fiable comme critère d'unicité SQL (voir schema.prisma).
  const existing = await prisma.summary.findFirst({
    where: { level, campaignId, partyId: partyId ?? null, scenarioId: scenarioId ?? null },
  });

  if (existing) {
    await prisma.summary.update({ where: { id: existing.id }, data: { content } });
  } else {
    await prisma.summary.create({ data: { level, campaignId, partyId, scenarioId, content } });
  }
}
