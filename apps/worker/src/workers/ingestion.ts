import type { Job } from "bullmq";
import { prisma } from "@superdiscogm/db";
import type { ScenarioIngestionJob } from "@superdiscogm/jobs";

// Pipeline d'ingestion de scénario [Q14] : asynchrone, notifie à la fin, pas de relecture
// humaine obligatoire avant mise en jeu [Q15]. Découpage en granularité "scène" avec
// métadonnées structurées (PNJ, lieu, déclencheurs, secrets) [Q16].
//
// TODO [task #7 — abstraction LLM multi-fournisseurs] : remplacer le découpage stub ci-dessous
// par un vrai appel au modèle (via le package `ai`) qui annote le texte et le répartit en scènes.
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

  // --- stub de découpage, à remplacer par l'appel LLM réel ---
  const content = scenario.rawContent ?? "";
  const stubPhases = content.length > 0 ? [{ title: "Scène 1", summary: content.slice(0, 280) }] : [];
  // -------------------------------------------------------------

  await prisma.$transaction([
    ...stubPhases.map((phase, index) =>
      prisma.phase.create({
        data: {
          scenarioId,
          order: index,
          title: phase.title,
          summary: phase.summary,
          npcTags: [],
        },
      })
    ),
    prisma.scenario.update({
      where: { id: scenarioId },
      data: { status: "READY" },
    }),
  ]);

  // TODO : notifier le Super utilisateur (via Socket.IO room `user:<id>` côté apps/web,
  // par exemple en publiant un événement Redis pub/sub que apps/web relaie).
}
