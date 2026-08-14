import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { checkRole } from "@/server/authz";

// Création réservée Super utilisateur (Admin par héritage) [Q05]. Texte collé [Q13] — l'upload
// de fichier passe par POST /api/scenarios/:id/files une fois le scénario créé.
export async function POST(request: Request) {
  const user = await checkRole("SUPER_USER");
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { title, rawContent } = await request.json();
  if (typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "Titre requis." }, { status: 400 });
  }

  const scenario = await prisma.scenario.create({
    data: {
      title: title.trim(),
      rawContent: typeof rawContent === "string" ? rawContent : null,
      createdById: user.id,
    },
  });

  return NextResponse.json(scenario, { status: 201 });
}
