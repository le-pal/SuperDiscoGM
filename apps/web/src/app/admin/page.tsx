import { prisma } from "@superdiscogm/db";
import { requireRole } from "@/server/authz";
import { AppShell } from "@/components/AppShell";
import { UsersTable } from "./users-table";
import { InviteForm } from "./invite-form";
import { SystemPromptEditor } from "./system-prompt-editor";
import { ModelSettingsForm } from "./model-settings-form";
import { PersonaLibrary } from "./persona-library";

// Portage de maquette/admin.html (étape 17) : utilisateurs [Q04], prompt système global +
// modèle/budget [Q09][Q37][Q03], bibliothèque de personas [Q06]. Réservé Admin — la gestion des
// utilisateurs n'a pas d'héritage vers Super utilisateur, contrairement au reste de cette page
// (personas/invitations restent accessibles à Super utilisateur ailleurs dans l'app).
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await requireRole("ADMIN");

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [users, settings, promptHistory, personas, campaigns, usageAgg, credentials] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.globalSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.promptVersion.findMany({
      where: { target: "GLOBAL_SYSTEM_PROMPT" },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { name: true } } },
    }),
    prisma.persona.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        campaignOverrides: { select: { name: true } },
        scenarioOverrides: { select: { title: true } },
      },
    }),
    prisma.campaign.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
    // Suivi de budget/coût [Q03] (étape 48) — somme du mois en cours, calculée à l'affichage
    // plutôt que maintenue en continu : volume attendu (usage perso/petit groupe [Q40]) trop
    // faible pour justifier un compteur dénormalisé.
    prisma.usageLog.aggregate({
      where: { createdAt: { gte: startOfMonth } },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
    }),
    prisma.providerCredential.findMany(),
  ]);
  const credentialsByProvider = Object.fromEntries(credentials.map((c) => [c.provider, c]));

  return (
    <AppShell user={admin} wide>
      <div className="section">
        <div className="section-head">
          <h2>Utilisateurs</h2>
        </div>
        <UsersTable users={users} />
      </div>

      <div className="section" style={{ marginTop: 28 }}>
        <div className="section-head">
          <h2>Inviter dans une campagne</h2>
        </div>
        <div className="card">
          <InviteForm campaigns={campaigns} />
        </div>
      </div>

      <div className="card-grid" style={{ alignItems: "start", marginTop: 28 }}>
        <SystemPromptEditor
          initialPrompt={settings.systemPrompt}
          history={promptHistory.map((v) => ({
            id: v.id,
            content: v.content,
            createdAt: v.createdAt.toISOString(),
            createdBy: { name: v.createdBy.name },
          }))}
        />
        <ModelSettingsForm
          activeProvider={settings.activeProvider}
          activeModel={settings.activeModel}
          monthlyBudget={settings.monthlyBudget ? Number(settings.monthlyBudget) : null}
          usageThisMonth={{
            costUsd: usageAgg._sum.costUsd ? Number(usageAgg._sum.costUsd) : null,
            inputTokens: usageAgg._sum.inputTokens ?? 0,
            outputTokens: usageAgg._sum.outputTokens ?? 0,
          }}
          credentials={Object.fromEntries(
            Object.entries(credentialsByProvider).map(([provider, c]) => [
              provider,
              { hasApiKey: !!c.apiKey, apiKeyLast4: c.apiKey ? c.apiKey.slice(-4) : null, baseUrl: c.baseUrl },
            ])
          )}
        />
      </div>

      <div className="section" style={{ marginTop: 28 }}>
        <div className="section-head">
          <h2>Bibliothèque de personas MJ</h2>
        </div>
        <PersonaLibrary
          personas={personas.map((p) => ({
            id: p.id,
            name: p.name,
            genreTag: p.genreTag,
            systemPromptFragment: p.systemPromptFragment,
            usedBy: [...p.campaignOverrides.map((c) => c.name), ...p.scenarioOverrides.map((s) => s.title)],
          }))}
        />
      </div>
    </AppShell>
  );
}
