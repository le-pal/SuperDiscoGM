import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { requireUser } from "@/server/authz";

// Rejoindre une partie en JOUEUR ou SPECTATEUR — n'importe quel utilisateur authentifié
// (héritage strict [Q04], pas de restriction de rôle système supplémentaire ici).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: partyId } = await params;

  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) return NextResponse.json({ error: "Partie introuvable." }, { status: 404 });

  const { role } = await request.json().catch(() => ({ role: "JOUEUR" }));
  const participantRole = role === "SPECTATEUR" ? "SPECTATEUR" : "JOUEUR";

  const participant = await prisma.partyParticipant.upsert({
    where: { partyId_userId: { partyId, userId: user.id } },
    create: { partyId, userId: user.id, role: participantRole },
    update: { role: participantRole },
  });

  return NextResponse.json(participant, { status: 201 });
}
