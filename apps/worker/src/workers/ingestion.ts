import type { Job } from "bullmq";
import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "@superdiscogm/db";
import { getConfiguredModel } from "@superdiscogm/llm";
import type { ScenarioIngestionJob } from "@superdiscogm/jobs";
import { publishNotification } from "../publisher";

// Pipeline d'ingestion de scénario [Q14] : asynchrone, notifie à la fin, pas de relecture
// humaine obligatoire avant mise en jeu [Q15]. Découpage en granularité "scène" avec
// métadonnées structurées (PNJ, lieu, déclencheurs, secrets) [Q16].
const phaseSchema = z.object({
  phases: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string(),
        locationTag: z.string().nullable(),
        npcTags: z.array(z.string()),
        entryConditions: z.string().nullable(),
        exitConditions: z.string().nullable(),
        secrets: z.string().nullable(),
      })
    )
    .min(1),
});

export async function processScenarioIngestion(job: Job<ScenarioIngestionJob>) {
  const { scenarioId } = job.data;

  const scenario = await prisma.scenario.findUniqueOrThrow({
    where: { id: scenarioId },
    include: { files: true },
  });

  await prisma.scenario.update({
    where: { id: scenarioId },
    data: { status: "ANALYZING" },
  });

  const content = scenario.rawContent ?? "";
  let phases: z.infer<typeof phaseSchema>["phases"] = [];

  if (content.trim().length > 0) {
    const model = await getConfiguredModel();
    const { object } = await generateObject({
      model,
      schema: phaseSchema,
      prompt:
        "Découpe ce scénario de jeu de rôle en scènes jouables. Pour chaque scène : un titre court, " +
        "un résumé, le lieu si identifiable, les PNJ présents, les conditions d'entrée/sortie, et les " +
        "secrets à ne pas révéler d'emblée. Ne laisse aucune scène sans résumé.\n\n" +
        `Scénario :\n${content}`,
    });
    phases = object.phases;
  }

  // Ré-analyse [Q18] : une partie déjà en cours ne doit pas casser en direct — les Phase encore
  // référencées par une Party ACTIVE/PAUSED (currentPhaseId) sont préservées, seules les Phase
  // orphelines (aucune partie ne pointe dessus, ex: une analyse précédente jamais jouée) sont
  // remplacées par le nouveau découpage.
  const referencedPhaseIds = (
    await prisma.party.findMany({
      where: { scenarioId, currentPhaseId: { not: null } },
      select: { currentPhaseId: true },
    })
  )
    .map((p) => p.currentPhaseId)
    .filter((id): id is string => id !== null);

  await prisma.$transaction([
    prisma.phase.deleteMany({
      where: { scenarioId, id: { notIn: referencedPhaseIds } },
    }),
    ...phases.map((phase, index) =>
      prisma.phase.create({
        data: {
          scenarioId,
          order: index,
          title: phase.title,
          summary: phase.summary,
          locationTag: phase.locationTag,
          npcTags: phase.npcTags,
          entryConditions: phase.entryConditions,
          exitConditions: phase.exitConditions,
          secrets: phase.secrets,
        },
      })
    ),
    prisma.scenario.update({
      where: { id: scenarioId },
      data: { status: "READY" },
    }),
  ]);

  await publishNotification({
    userId: scenario.createdById,
    type: "scenario:ready",
    data: { scenarioId, title: scenario.title, phaseCount: phases.length },
  });
}
