import { requireUser } from "@/server/authz";
import { AppShell } from "@/components/AppShell";
import { getDashboardData } from "@/server/dashboard";
import { hasRole } from "@/lib/roles";
import { NewCampaignForm } from "./new-campaign-form";
import { MyPartiesGrid } from "./my-parties-grid";

// Portage de maquette/dashboard.html (étapes 43-44 du PLAN.md) — "mes campagnes" (Super
// utilisateur+, gestion [Q05]) + "mes parties" (tout le monde, sans action de gestion pour un
// simple Utilisateur, cf doc/partie/spec.md §Tableau de bord).
// force-dynamic : dépend de la DB au runtime (participations/campagnes de l'utilisateur courant).
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { ACTIVE: "En direct", PAUSED: "En pause", ENDED: "Terminée" };

export default async function Home() {
  const user = await requireUser();
  const { myParties, managedCampaigns } = await getDashboardData(user);
  const isSuperUser = hasRole(user, "SUPER_USER");

  return (
    <AppShell user={user} wide>
      {isSuperUser && managedCampaigns && (
        <>
          <div className="section-head">
            <h1>Mes campagnes</h1>
            <div className="flex gap-8">
              <a className="btn ghost small" href="/scenarios/new">+ Importer un scénario</a>
              <NewCampaignForm />
            </div>
          </div>

          <div className="card-grid">
            {managedCampaigns.map((c) => (
              <div key={c.id} className="card">
                <h3>{c.name}</h3>
                <p className="muted" style={{ fontSize: ".85rem" }}>
                  {c.parties.length} partie{c.parties.length > 1 ? "s" : ""}
                </p>
                {c.parties.map((p) => (
                  <div key={p.partyId} className="flex between" style={{ marginTop: 8 }}>
                    <a href={`/scenarios/${p.scenario.id}`} className="muted" style={{ fontSize: ".82rem" }}>
                      {p.scenario.title}
                    </a>
                    <span className={`badge ${p.status === "ACTIVE" ? "status-ok" : "tag"}`}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </div>
                ))}
              </div>
            ))}
            {managedCampaigns.length === 0 && (
              <div
                className="card"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", borderStyle: "dashed", color: "var(--text-muted)", minHeight: 150 }}
              >
                Aucune campagne pour l&apos;instant — « + Nouvelle campagne » ci-dessus.
              </div>
            )}
          </div>
        </>
      )}

      <div className="section" style={{ marginTop: isSuperUser ? 36 : 0 }}>
        <div className="section-head">{isSuperUser ? <h2>Mes parties</h2> : <h1>Mes parties</h1>}</div>
        <MyPartiesGrid parties={myParties} />
      </div>
    </AppShell>
  );
}
