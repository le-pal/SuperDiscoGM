import { redirect } from "next/navigation";
import { prisma } from "@superdiscogm/db";
import { requireUser } from "@/server/authz";
import { hasRole } from "@/lib/roles";
import { getMessagesPage } from "@/server/partyMessages";
import { toCharacterSheetView } from "@/lib/characterSheet";
import { inferAmbiance } from "@/lib/ambiance";
import { PartyScreen } from "./PartyScreen";

// Portage de maquette/ecran-partie.html (étape 41) — écran de jeu temps réel. Volontairement en
// dehors d'AppShell : contrairement au reste de l'app, cette page dédie tout le topbar au
// contexte de partie (campagne/scène active/présence), comme la maquette. Le sélecteur "point de
// vue" et le sélecteur d'ambiance manuel de la maquette sont des outils de démo explicitement
// écartés du vrai produit (cf CLAUDE.md) — ici chaque utilisateur ne voit que SA vue (filtrage
// serveur), et l'ambiance suit automatiquement le lieu de la phase active (étape 40, hypothèse).
export const dynamic = "force-dynamic";

export default async function PartyPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: partyId } = await params;

  const [party, participant] = await Promise.all([
    prisma.party.findUnique({
      where: { id: partyId },
      include: {
        campaign: { select: { id: true, name: true } },
        scenario: { select: { id: true, title: true } },
        currentPhase: true,
        participants: { include: { user: { select: { id: true, name: true, avatarColor: true, avatarInitials: true } } } },
      },
    }),
    prisma.partyParticipant.findUnique({ where: { partyId_userId: { partyId, userId: user.id } } }),
  ]);

  if (!party) redirect("/");
  if (!participant && !hasRole(user, "SUPER_USER")) redirect("/");

  const [sheetRecord, note, { messages, nextCursor }] = await Promise.all([
    prisma.characterSheet.findUnique({ where: { userId_campaignId: { userId: user.id, campaignId: party.campaignId } } }),
    prisma.playerNote.findUnique({ where: { userId_campaignId: { userId: user.id, campaignId: party.campaignId } } }),
    getMessagesPage(partyId, user.id, { limit: 50 }),
  ]);

  const participantsById = Object.fromEntries(
    party.participants.map((p) => [
      p.userId,
      { name: p.user.name, avatarColor: p.user.avatarColor, avatarInitials: p.user.avatarInitials, role: p.role },
    ])
  );

  return (
    <PartyScreen
      partyId={party.id}
      currentUser={{ id: user.id, name: user.name, avatarColor: user.avatarColor }}
      participantsById={participantsById}
      campaignId={party.campaignId}
      campaignName={party.campaign.name}
      scenarioTitle={party.scenario.title}
      currentPhase={party.currentPhase ? { title: party.currentPhase.title, order: party.currentPhase.order } : null}
      ambiance={inferAmbiance(party.currentPhase?.locationTag)}
      initialMessages={messages.map((m) => ({
        id: m.id,
        partyId: m.partyId,
        authorType: m.authorType,
        authorUserId: m.authorUserId ?? undefined,
        content: m.content,
        visibleToUserIds: m.visibleToUserIds,
        createdAt: m.createdAt,
      }))}
      initialNextCursor={nextCursor}
      ownSheet={sheetRecord ? toCharacterSheetView(sheetRecord) : null}
      initialNotes={note?.content ?? ""}
    />
  );
}
