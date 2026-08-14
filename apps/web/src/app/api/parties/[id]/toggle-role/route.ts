import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { requireUser } from "@/server/authz";

// Bascule libre Utilisateur <-> Spectateur en cours de partie [Q08] — la fiche de personnage
// est conservée (CharacterSheet est liée à la campagne, pas à la participation).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: partyId } = await params;

  const participant = await prisma.partyParticipant.findUnique({
    where: { partyId_userId: { partyId, userId: user.id } },
  });
  if (!participant) return NextResponse.json({ error: "Vous ne participez pas à cette partie." }, { status: 404 });

  const nextRole = participant.role === "JOUEUR" ? "SPECTATEUR" : "JOUEUR";
  const updated = await prisma.partyParticipant.update({
    where: { partyId_userId: { partyId, userId: user.id } },
    data: { role: nextRole },
  });

  return NextResponse.json(updated);
}
