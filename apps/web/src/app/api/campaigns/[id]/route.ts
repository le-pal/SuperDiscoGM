import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { requireUser } from "@/server/authz";

// Lecture ouverte à tout utilisateur authentifié (un joueur rejoint doit pouvoir la consulter,
// pas seulement son créateur) — pas de restriction de rôle ici, contrairement à la création.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { scenarios: { include: { scenario: true }, orderBy: { order: "asc" } }, persona: true },
  });

  if (!campaign) return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  return NextResponse.json(campaign);
}
