import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { checkRole } from "@/server/authz";

const VALID_PROVIDERS = ["anthropic", "openai", "ollama", "openrouter"];

// Accès (clé API + endpoint optionnel) par fournisseur, configurable depuis l'admin [Q37] —
// avant cet ajout, seule une variable d'env fixée au déploiement pouvait fournir une clé,
// impossible à changer sans redéployer (demande explicite de Philippe : "on devrait pouvoir
// saisir un accès à OpenRouter"). La clé n'est JAMAIS renvoyée en clair une fois enregistrée.
export async function GET() {
  const user = await checkRole("ADMIN");
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const credentials = await prisma.providerCredential.findMany();
  return NextResponse.json(
    credentials.map((c) => ({
      provider: c.provider,
      hasApiKey: !!c.apiKey,
      apiKeyLast4: c.apiKey ? c.apiKey.slice(-4) : null,
      baseUrl: c.baseUrl,
    }))
  );
}

export async function PUT(request: Request) {
  const user = await checkRole("ADMIN");
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { provider, apiKey, baseUrl } = await request.json();
  if (typeof provider !== "string" || !VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: `Fournisseur invalide (attendu : ${VALID_PROVIDERS.join(", ")}).` }, { status: 400 });
  }

  const data: { apiKey?: string | null; baseUrl?: string | null } = {};
  if (apiKey !== undefined) data.apiKey = typeof apiKey === "string" && apiKey.trim().length > 0 ? apiKey.trim() : null;
  if (baseUrl !== undefined) data.baseUrl = typeof baseUrl === "string" && baseUrl.trim().length > 0 ? baseUrl.trim() : null;

  const updated = await prisma.providerCredential.upsert({
    where: { provider },
    create: { provider, ...data },
    update: data,
  });

  return NextResponse.json({
    provider: updated.provider,
    hasApiKey: !!updated.apiKey,
    apiKeyLast4: updated.apiKey ? updated.apiKey.slice(-4) : null,
    baseUrl: updated.baseUrl,
  });
}
