import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { requireUser } from "@/server/authz";
import { hasRole } from "@/lib/roles";

// Historique paginé, scroll infini uniquement en V1 [Q29] — pagination par curseur (createdAt du
// plus ancien message déjà chargé) plutôt que par offset, pour rester correcte même si de
// nouveaux messages arrivent pendant que le joueur remonte l'historique.
//
// Accès : participant de la partie, ou Super utilisateur+ (supervision, même logique que la vue
// table des fiches de personnage). Le filtrage de confidentialité [Q26] s'applique ensuite à
// TOUT le monde de la même façon, Super utilisateur inclus — un aparté privé reste privé même
// pour qui supervise la table, seul le MJ-IA choisit de le révéler (reveal_huddle, étape 36).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const url = new URL(request.url);
  const cursorId = url.searchParams.get("cursor");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 100);

  const cursorMessage = cursorId ? await prisma.message.findUnique({ where: { id: cursorId } }) : null;

  const page = await prisma.message.findMany({
    where: { partyId, ...(cursorMessage ? { createdAt: { lt: cursorMessage.createdAt } } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: { authorUser: { select: { id: true, name: true, avatarColor: true } } },
  });

  const hasMore = page.length > limit;
  const batch = page.slice(0, limit);
  const nextCursor = hasMore ? batch[batch.length - 1].id : null;

  // Filtrage serveur — jamais laisser fuiter un aparté en comptant sur un filtrage client [Q26].
  const visible = batch.filter((m) => m.visibleToUserIds.length === 0 || m.visibleToUserIds.includes(user.id));

  return NextResponse.json({ messages: visible.reverse(), nextCursor });
}
