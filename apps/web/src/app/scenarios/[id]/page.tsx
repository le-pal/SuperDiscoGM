import { prisma } from "@superdiscogm/db";
import { requireRole } from "@/server/authz";
import { AppShell } from "@/components/AppShell";
import { AnalysisPanel } from "./analysis-panel";

// Portage de maquette/ingestion-scenario.html (étape 24) — vue d'un scénario existant : contenu
// fourni, statut d'analyse, scénario digéré. La création (étape 1) est sur /scenarios/new.
export const dynamic = "force-dynamic";

export default async function ScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("SUPER_USER");
  const { id } = await params;

  const scenario = await prisma.scenario.findUnique({
    where: { id },
    include: {
      phases: { orderBy: { order: "asc" } },
      files: { select: { id: true, filename: true, mimeType: true, uploadedAt: true } },
    },
  });

  if (!scenario) {
    return (
      <AppShell user={user}>
        <p className="muted">Scénario introuvable.</p>
      </AppShell>
    );
  }

  return (
    <AppShell user={user}>
      <h1>{scenario.title}</h1>
      <p className="muted">Étape 1 : fournir le contenu. Étape 2 : lancer l&apos;analyse (asynchrone). Étape 3 : le scénario digéré, jouable immédiatement.</p>
      <div className="hr" />

      <div className="section">
        <div className="section-head"><h2>1 · Contenu du scénario</h2></div>
        <div className="card">
          {scenario.files.length > 0 && (
            <p className="muted" style={{ fontSize: ".85rem" }}>
              Fichier(s) importé(s) : {scenario.files.map((f) => f.filename).join(", ")}
            </p>
          )}
          <p className="muted" style={{ fontSize: ".85rem", whiteSpace: "pre-wrap", maxHeight: 240, overflowY: "auto" }}>
            {scenario.rawContent || "(aucun contenu fourni pour l'instant)"}
          </p>
        </div>
      </div>

      <AnalysisPanel scenarioId={scenario.id} status={scenario.status} phases={scenario.phases} />
    </AppShell>
  );
}
