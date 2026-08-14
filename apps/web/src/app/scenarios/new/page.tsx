import { requireRole } from "@/server/authz";
import { AppShell } from "@/components/AppShell";
import { NewScenarioForm } from "./new-scenario-form";

export const dynamic = "force-dynamic";

export default async function NewScenarioPage() {
  const user = await requireRole("SUPER_USER");

  return (
    <AppShell user={user}>
      <h1>Nouveau scénario</h1>
      <p className="muted">Étape 1 : fournir le contenu. Étape 2 : lancer l&apos;analyse (asynchrone). Étape 3 : le scénario digéré, jouable immédiatement.</p>
      <div className="hr" />
      <NewScenarioForm />
    </AppShell>
  );
}
