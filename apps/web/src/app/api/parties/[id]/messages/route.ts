import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { requireUser } from "@/server/authz";
import { hasRole } from "@/lib/roles";
import { getMessagesPage } from "@/server/partyMessages";

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
  const limit = Number(url.searchParams.get("limit") ?? 50) || 50;

  const result = await getMessagesPage(partyId, user.id, { cursorId, limit });
  return NextResponse.json(result);
}
