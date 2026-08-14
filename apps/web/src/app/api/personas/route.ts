import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { checkRole, requireUser } from "@/server/authz";

// Bibliothèque globale réutilisable, gérée par le Super utilisateur [Q06].
export async function POST(request: Request) {
  const user = await checkRole("SUPER_USER");
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { name, genreTag, systemPromptFragment } = await request.json();
  if (
    typeof name !== "string" ||
    typeof genreTag !== "string" ||
    typeof systemPromptFragment !== "string" ||
    !name.trim() ||
    !systemPromptFragment.trim()
  ) {
    return NextResponse.json({ error: "name, genreTag et systemPromptFragment sont requis." }, { status: 400 });
  }

  const persona = await prisma.persona.create({
    data: { name: name.trim(), genreTag: genreTag.trim(), systemPromptFragment, createdById: user.id },
  });

  return NextResponse.json(persona, { status: 201 });
}

export async function GET() {
  await requireUser();
  const personas = await prisma.persona.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(personas);
}
