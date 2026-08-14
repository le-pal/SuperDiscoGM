import { NextResponse } from "next/server";
import { checkRole } from "@/server/authz";
import { triggerScenarioAnalysis } from "@/server/scenarioAnalysis";

// Ré-analyse d'un scénario modifié [Q18]. Route distincte de /analyze pour la clarté de l'API
// (intention explicite), mais même logique — le job d'ingestion préserve déjà les Phase
// référencées par une Party ACTIVE/PAUSED, une partie en cours ne casse pas en direct.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkRole("SUPER_USER");
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { id: scenarioId } = await params;
  const result = await triggerScenarioAnalysis(scenarioId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ status: "ANALYZING" });
}
