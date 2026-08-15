import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { requireUser } from "@/server/authz";
import { hasRole } from "@/lib/roles";

// "Reprendre une partie" [Q11] — pas de logique de reprise séparée : l'état exact (phase
// active, résumé le plus récent, mémoire d'entités) est déjà porté nativement par le modèle
// de données, il suffit de le recharger. Repasse aussi la partie en ACTIVE si elle était PAUSED.
// Réservé aux participants (ou Super utilisateur+, supervision) — AUDIT.md avait aussi trouvé
// cette route ouverte à tout compte authentifié, et `currentPhase` incluait `secrets` en clair.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: partyId } = await params;

  const [party, participant] = await Promise.all([
    prisma.party.findUnique({ where: { id: partyId } }),
    prisma.partyParticipant.findUnique({ where: { partyId_userId: { partyId, userId: user.id } } }),
  ]);
  if (!party) return NextResponse.json({ error: "Partie introuvable." }, { status: 404 });
  if (!participant && !hasRole(user, "SUPER_USER")) {
    return NextResponse.json({ error: "Vous ne participez pas à cette partie." }, { status: 403 });
  }

  if (party.status === "PAUSED") {
    await prisma.party.update({ where: { id: partyId }, data: { status: "ACTIVE" } });
  }

  const state = await prisma.party.findUnique({
    where: { id: partyId },
    include: {
      currentPhase: { select: { id: true, title: true, order: true, locationTag: true, summary: true } },
      campaign: { select: { id: true, name: true } },
      scenario: { select: { id: true, title: true } },
      summaries: { where: { level: "SESSION" }, orderBy: { updatedAt: "desc" }, take: 1 },
      participants: { include: { user: { select: { id: true, name: true, avatarColor: true } } } },
    },
  });

  return NextResponse.json(state);
}
