import type { Job } from "bullmq";
import { prisma } from "@superdiscogm/db";
import type { EntityMemoryExtractionJob } from "@superdiscogm/jobs";

// Mémoire indexée par entité [Q41][Q42][Q43] : extraction automatique déclenchée après un
// échange marquant, granularité "échange/scène". Persistante au niveau campagne [Q45].
//
// TODO [task #7] : remplacer l'extraction stub par un vrai appel LLM qui identifie les
// entités (PNJ/lieux/factions/quêtes) mentionnées dans la plage de messages et met à jour
// leur fiche résumé courte.
export async function processEntityMemoryExtraction(job: Job<EntityMemoryExtractionJob>) {
  const { campaignId, partyId, fromMessageId, toMessageId } = job.data;

  const messages = await prisma.message.findMany({
    where: { partyId },
    orderBy: { createdAt: "asc" },
  });

  const startIdx = messages.findIndex((m) => m.id === fromMessageId);
  const endIdx = messages.findIndex((m) => m.id === toMessageId);
  if (startIdx === -1 || endIdx === -1) return;
  const range = messages.slice(startIdx, endIdx + 1);
  if (range.length === 0) return;

  // --- stub : pas de vraie détection d'entité tant que le LLM n'est pas branché ---
  const detectedEntities: { type: "NPC" | "LOCATION" | "FACTION" | "QUEST"; name: string; summary: string }[] = [];
  // ---------------------------------------------------------------------------------

  for (const entity of detectedEntities) {
    const memory = await prisma.entityMemory.upsert({
      where: {
        campaignId_type_name: { campaignId, type: entity.type, name: entity.name },
      },
      create: { campaignId, type: entity.type, name: entity.name, summary: entity.summary },
      update: { summary: entity.summary },
    });

    await prisma.entityMemoryIndexEntry.create({
      data: {
        entityMemoryId: memory.id,
        partyId,
        fromMessageId,
        toMessageId,
      },
    });
  }
}
