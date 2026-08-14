import { prisma } from "@superdiscogm/db";
import { scenarioIngestionQueue } from "./queue";

/**
 * Déclenche l'analyse (première fois ou ré-analyse [Q18]) — même chemin pour les deux : le job
 * d'ingestion préserve déjà les Phase référencées par une Party ACTIVE/PAUSED, pas de casse en
 * direct. Retourne une erreur explicite plutôt qu'un throw, pour rester simple à consommer par
 * les deux routes (analyze/reanalyze).
 */
export async function triggerScenarioAnalysis(
  scenarioId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId } });
  if (!scenario) return { ok: false, error: "Scénario introuvable.", status: 404 };

  if (!scenario.rawContent || scenario.rawContent.trim().length === 0) {
    return { ok: false, error: "Le scénario n'a pas de contenu à analyser.", status: 400 };
  }

  await prisma.scenario.update({ where: { id: scenarioId }, data: { status: "ANALYZING" } });
  await scenarioIngestionQueue.add("analyze", { scenarioId });

  return { ok: true };
}
