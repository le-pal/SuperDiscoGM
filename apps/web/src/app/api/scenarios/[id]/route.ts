import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { checkRole } from "@/server/authz";

// Réservé Super utilisateur+ [Q05] — cette route renvoie Phase.secrets et rawContent en clair
// (faille critique trouvée par AUDIT.md : n'importe quel compte authentifié pouvait lire les
// secrets de MJ de n'importe quel scénario). Les joueurs découvrent le scénario en jouant,
// filtré/rythmé par le MJ-IA — jamais en lisant le contenu digéré brut.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkRole("SUPER_USER");
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { id } = await params;

  const scenario = await prisma.scenario.findUnique({
    where: { id },
    include: {
      phases: { orderBy: { order: "asc" } },
      files: { select: { id: true, filename: true, mimeType: true, uploadedAt: true } }, // jamais data (Bytes) dans une liste
    },
  });

  if (!scenario) return NextResponse.json({ error: "Scénario introuvable." }, { status: 404 });
  return NextResponse.json(scenario);
}
