import type { Job } from "bullmq";
import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "@superdiscogm/db";
import { getConfiguredModelInfo, recordUsage } from "@superdiscogm/llm";
import type { EntityMemoryExtractionJob } from "@superdiscogm/jobs";

// Mémoire indexée par entité [Q41][Q42][Q43] : extraction automatique déclenchée après un
// échange marquant, granularité "échange/scène". Persistante au niveau campagne [Q45].
const entitySchema = z.object({
  entities: z.array(
    z.object({
      type: z.enum(["NPC", "LOCATION", "FACTION", "QUEST"]),
      name: z.string(),
      // Résumé à jour de la relation/l'état — doit intégrer l'historique connu, pas seulement
      // cet échange (le modèle reçoit les fiches existantes en contexte, voir prompt ci-dessous).
      summary: z.string(),
    })
  ),
});

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

  const transcript = range
    .map((m) => `[${m.authorType}] ${m.content}`)
    .join("\n");

  // Fiches déjà connues de la campagne — permet au modèle de mettre à jour un résumé existant
  // plutôt que de repartir de zéro à chaque échange (mémoire persistante au niveau campagne [Q45]).
  const existing = await prisma.entityMemory.findMany({ where: { campaignId } });
  const existingContext = existing.length
    ? existing.map((e) => `- (${e.type}) ${e.name} : ${e.summary}`).join("\n")
    : "(aucune entité connue pour l'instant)";

  const { model, provider, modelName } = await getConfiguredModelInfo();
  const { object, usage } = await generateObject({
    model,
    schema: entitySchema,
    prompt:
      "Identifie les PNJ, lieux, factions et quêtes mentionnés dans cet échange de jeu de rôle. " +
      "Pour chaque entité déjà connue, mets à jour son résumé pour refléter l'état le plus récent " +
      "(ne perds pas les infos importantes déjà connues). N'invente pas d'entité qui n'apparaît pas " +
      "explicitement dans l'échange.\n\n" +
      `Entités déjà connues :\n${existingContext}\n\n` +
      `Échange à analyser :\n${transcript}`,
  });

  await recordUsage({ provider, model: modelName, usage, source: "entity_memory" }).catch((err) => {
    console.error("[usage] échec de journalisation (entity_memory) :", err);
  });

  for (const entity of object.entities) {
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
