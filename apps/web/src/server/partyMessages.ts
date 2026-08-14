import { prisma } from "@superdiscogm/db";

// Historique paginé par curseur (étape 38, scroll infini [Q29]) — factorisé pour être appelé
// aussi bien depuis la page serveur de l'écran de partie (étape 41, premier chargement) que
// depuis GET /api/parties/:id/messages (chargement des messages plus anciens côté client).
export async function getMessagesPage(
  partyId: string,
  userId: string,
  opts: { cursorId?: string | null; limit?: number } = {}
) {
  const limit = Math.min(opts.limit ?? 50, 100);
  const cursorMessage = opts.cursorId ? await prisma.message.findUnique({ where: { id: opts.cursorId } }) : null;

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
  const visible = batch.filter((m) => m.visibleToUserIds.length === 0 || m.visibleToUserIds.includes(userId));

  return { messages: visible.reverse(), nextCursor };
}
