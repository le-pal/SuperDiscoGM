import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { checkRole, requireUser } from "@/server/authz";

// Lancer une nouvelle partie [Q11] — Super utilisateur, sur un couple campagne+scénario. La
// phase active démarre à la première scène (order 0) si le scénario est déjà READY.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkRole("SUPER_USER");
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { id: campaignId } = await params;
  const { scenarioId } = await request.json();
  if (typeof scenarioId !== "string") {
    return NextResponse.json({ error: "scenarioId requis." }, { status: 400 });
  }

  const [campaign, scenario] = await Promise.all([
    prisma.campaign.findUnique({ where: { id: campaignId } }),
    prisma.scenario.findUnique({ where: { id: scenarioId }, include: { phases: { orderBy: { order: "asc" }, take: 1 } } }),
  ]);
  if (!campaign) return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  if (!scenario) return NextResponse.json({ error: "Scénario introuvable." }, { status: 404 });

  const party = await prisma.party.create({
    data: {
      campaignId,
      scenarioId,
      currentPhaseId: scenario.phases[0]?.id ?? null,
    },
  });

  return NextResponse.json(party, { status: 201 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id: campaignId } = await params;
  const parties = await prisma.party.findMany({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
    include: { scenario: { select: { id: true, title: true } } },
  });
  return NextResponse.json(parties);
}
