import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { requireUser } from "@/server/authz";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
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
