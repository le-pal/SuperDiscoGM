import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { requireUser } from "@/server/authz";
import { hasRole } from "@/lib/roles";

// Rejoindre une partie en JOUEUR ou SPECTATEUR — n'importe quel utilisateur authentifié pouvait
// jusqu'ici rejoindre N'IMPORTE QUELLE partie de l'instance, sans lien avec la campagne
// (faille critique trouvée par AUDIT.md : casse le modèle multi-tenant [Q02]). Autorisé
// désormais seulement pour : le créateur de la campagne, un Super utilisateur+ (supervision,
// héritage [Q04]), ou quelqu'un qui a effectivement accepté une invitation pour CETTE campagne
// (Invitation.usedById, lien posé lors de invite/accept — voir schema.prisma).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: partyId } = await params;

  const party = await prisma.party.findUnique({ where: { id: partyId }, include: { campaign: true } });
  if (!party) return NextResponse.json({ error: "Partie introuvable." }, { status: 404 });

  const isCampaignOwner = party.campaign.createdById === user.id;
  const isSupervisor = hasRole(user, "SUPER_USER");
  const wasInvited = isCampaignOwner || isSupervisor
    ? true
    : (await prisma.invitation.findFirst({ where: { campaignId: party.campaignId, usedById: user.id } })) !== null;

  if (!wasInvited) {
    return NextResponse.json({ error: "Vous n'avez pas d'invitation pour cette campagne." }, { status: 403 });
  }

  const { role } = await request.json().catch(() => ({ role: "JOUEUR" }));
  const participantRole = role === "SPECTATEUR" ? "SPECTATEUR" : "JOUEUR";

  const participant = await prisma.partyParticipant.upsert({
    where: { partyId_userId: { partyId, userId: user.id } },
    create: { partyId, userId: user.id, role: participantRole },
    update: { role: participantRole },
  });

  return NextResponse.json(participant, { status: 201 });
}
