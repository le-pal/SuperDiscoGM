import { prisma } from "@superdiscogm/db";
import { requireUser } from "@/server/authz";
import { AppShell } from "@/components/AppShell";
import { LogoutButton } from "./logout-button";

// Page d'accueil minimale — sert de "hello world" bout en bout : Docker -> Postgres -> Prisma ->
// Next.js -> auth -> design system. À remplacer par le vrai tableau de bord (étapes 42-44 du
// PLAN.md, portage de maquette/dashboard.html).
// force-dynamic : la page dépend de la DB au runtime, DATABASE_URL n'existe pas au moment du
// build (injectée seulement au démarrage du conteneur) — pas de pré-rendu statique possible ici.
export const dynamic = "force-dynamic";

export default async function Home() {
  // Vérification authoritative ici, jamais seulement dans proxy.ts (cf src/proxy.ts).
  const user = await requireUser();

  const settings = await prisma.globalSettings.findUnique({ where: { id: 1 } });

  return (
    <AppShell user={user}>
      <div className="mockup-banner">
        🚧 Tableau de bord pas encore porté (étapes 42-44 du PLAN.md) — cette page ne sert que de vérification bout en bout.
      </div>
      <h1>SuperDiscoGM</h1>
      {settings ? (
        <p>
          ✅ Connecté à la base de données — fournisseur LLM actif :{" "}
          <strong>
            {settings.activeProvider}/{settings.activeModel}
          </strong>
        </p>
      ) : (
        <p>⚠️ Connecté à la base, mais aucun réglage global (GlobalSettings) trouvé — as-tu lancé le seed ?</p>
      )}
      <LogoutButton />
    </AppShell>
  );
}
