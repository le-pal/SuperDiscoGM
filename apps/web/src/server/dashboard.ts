import type { User } from "@superdiscogm/db";
import { prisma } from "@superdiscogm/db";
import { hasRole } from "@/lib/roles";

// Agrégation dashboard (étape 43) : "mes parties" pour tout le monde + "campagnes que je gère"
// pour Super utilisateur+ — un simple Utilisateur ne voit que ses parties rejointes, sans les
// actions de gestion (doc/partie/spec.md §Tableau de bord). Fonction partagée entre la page
// serveur (/, portage dashboard.html) et l'API REST (GET /api/dashboard) pour éviter qu'une page
// serveur ne s'auto-appelle en HTTP.
export async function getDashboardData(user: User) {
  const myParticipations = await prisma.partyParticipant.findMany({
    where: { userId: user.id },
    orderBy: { joinedAt: "desc" },
    include: {
      party: {
        include: {
          campaign: { select: { id: true, name: true } },
          scenario: { select: { id: true, title: true } },
          currentPhase: { select: { id: true, title: true, order: true } },
          participants: { include: { user: { select: { id: true, name: true, avatarColor: true } } } },
        },
      },
    },
  });

  const myParties = myParticipations.map((p) => ({
    partyId: p.party.id,
    myRole: p.role,
    status: p.party.status,
    campaign: p.party.campaign,
    scenario: p.party.scenario,
    currentPhase: p.party.currentPhase,
    participants: p.party.participants.map((pp) => ({
      id: pp.user.id,
      name: pp.user.name,
      avatarColor: pp.user.avatarColor,
      role: pp.role,
    })),
  }));

  let managedCampaigns: Array<{
    id: string;
    name: string;
    parties: Array<{
      partyId: string;
      status: string;
      scenario: { id: string; title: string };
      playerCount: number;
      spectatorCount: number;
    }>;
  }> | null = null;

  if (hasRole(user, "SUPER_USER")) {
    const campaigns = await prisma.campaign.findMany({
      where: user.role === "ADMIN" ? {} : { createdById: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        parties: {
          orderBy: { createdAt: "desc" },
          include: {
            scenario: { select: { id: true, title: true } },
            participants: { select: { role: true } },
          },
        },
      },
    });

    managedCampaigns = campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      parties: c.parties.map((p) => ({
        partyId: p.id,
        status: p.status,
        scenario: p.scenario,
        playerCount: p.participants.filter((pp) => pp.role === "JOUEUR").length,
        spectatorCount: p.participants.filter((pp) => pp.role === "SPECTATEUR").length,
      })),
    }));
  }

  return { myParties, managedCampaigns };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
