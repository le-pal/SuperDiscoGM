import { prisma } from "@superdiscogm/db";

// Page de démarrage minimale — sert de "hello world" bout en bout : Docker -> Postgres ->
// Prisma -> Next.js. À remplacer par le vrai tableau de bord (portage de maquette/dashboard.html).
// force-dynamic : la page dépend de la DB au runtime, DATABASE_URL n'existe pas au moment du
// build (injectée seulement par docker-entrypoint.sh) — pas de pré-rendu statique possible ici.
export const dynamic = "force-dynamic";

export default async function Home() {
  const settings = await prisma.globalSettings.findUnique({ where: { id: 1 } });

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 640 }}>
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
    </main>
  );
}
