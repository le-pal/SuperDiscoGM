import type { Job } from "bullmq";
import { prisma } from "@superdiscogm/db";
import type { SummaryConsolidationJob } from "@superdiscogm/jobs";

// Hiérarchie de résumés à 3 niveaux [Q22] : session -> arc/scénario -> campagne.
// Évite que le résumé lui-même redevienne le problème de contexte sur une longue campagne.
//
// TODO [task #7] : remplacer la consolidation stub par un vrai appel LLM qui condense
// les résumés enfants (ou les messages bruts pour le niveau SESSION) en un résumé du niveau demandé.
export async function processSummaryConsolidation(job: Job<SummaryConsolidationJob>) {
  const { level, campaignId, partyId, scenarioId } = job.data;

  if (level === "SESSION" && !partyId) {
    throw new Error("partyId requis pour un résumé de niveau SESSION");
  }
  if (level === "ARC" && !scenarioId) {
    throw new Error("scenarioId requis pour un résumé de niveau ARC");
  }

  // --- stub : pas de vraie consolidation tant que le LLM n'est pas branché ---
  const content = `Résumé ${level} — à générer (job placeholder).`;
  // -----------------------------------------------------------------------------

  await prisma.summary.upsert({
    where: {
      level_campaignId_partyId_scenarioId: {
        level,
        campaignId,
        partyId: partyId ?? null,
        scenarioId: scenarioId ?? null,
      },
    },
    create: { level, campaignId, partyId, scenarioId, content },
    update: { content },
  });
}
