import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { checkRole, requireUser } from "@/server/authz";
import { snapshotPromptVersion } from "@/server/promptVersion";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const persona = await prisma.persona.findUnique({ where: { id } });
  if (!persona) return NextResponse.json({ error: "Persona introuvable." }, { status: 404 });
  return NextResponse.json(persona);
}

// Édition d'une persona [Q06] — fragment de prompt versionné avec retour arrière, comme le
// prompt système global (voir history/route.ts).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkRole("SUPER_USER");
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { id } = await params;
  const current = await prisma.persona.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Persona introuvable." }, { status: 404 });

  const { name, genreTag, systemPromptFragment } = await request.json();

  const data: Record<string, unknown> = {};
  if (typeof name === "string") data.name = name;
  if (typeof genreTag === "string") data.genreTag = genreTag;

  if (typeof systemPromptFragment === "string" && systemPromptFragment !== current.systemPromptFragment) {
    data.systemPromptFragment = systemPromptFragment;
    await snapshotPromptVersion({
      target: "PERSONA",
      personaId: id,
      previousContent: current.systemPromptFragment,
      createdById: user.id,
    });
  }

  const persona = await prisma.persona.update({ where: { id }, data });
  return NextResponse.json(persona);
}
