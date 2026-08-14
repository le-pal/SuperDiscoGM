import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { checkRole } from "@/server/authz";
import { scenarioIngestionQueue } from "@/server/queue";

// Déclenche l'analyse asynchrone [Q14] — passe le statut à ANALYZING et enqueue le job, déjà
// consommé côté apps/worker (ingestion.ts, appel LLM réel). Pas de relecture humaine obligatoire
// avant mise en jeu [Q15] : dès que le worker termine, le scénario est READY et jouable.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkRole("SUPER_USER");
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { id: scenarioId } = await params;
  const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId } });
  if (!scenario) return NextResponse.json({ error: "Scénario introuvable." }, { status: 404 });

  if (!scenario.rawContent || scenario.rawContent.trim().length === 0) {
    return NextResponse.json({ error: "Le scénario n'a pas de contenu à analyser." }, { status: 400 });
  }

  await prisma.scenario.update({ where: { id: scenarioId }, data: { status: "ANALYZING" } });
  await scenarioIngestionQueue.add("analyze", { scenarioId });

  return NextResponse.json({ status: "ANALYZING" });
}
