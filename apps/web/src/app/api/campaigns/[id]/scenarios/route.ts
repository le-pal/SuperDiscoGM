import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { checkRole } from "@/server/authz";

// Rattache un scénario à une campagne, dans un ordre donné — une campagne enchaîne plusieurs
// scénarios comme des chapitres [Q10]. Un scénario reste réutilisable dans plusieurs campagnes.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkRole("SUPER_USER");
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { id: campaignId } = await params;
  const { scenarioId, order } = await request.json();

  if (typeof scenarioId !== "string") {
    return NextResponse.json({ error: "scenarioId requis." }, { status: 400 });
  }

  const [campaign, scenario] = await Promise.all([
    prisma.campaign.findUnique({ where: { id: campaignId } }),
    prisma.scenario.findUnique({ where: { id: scenarioId } }),
  ]);
  if (!campaign) return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  if (!scenario) return NextResponse.json({ error: "Scénario introuvable." }, { status: 404 });

  const resolvedOrder =
    typeof order === "number"
      ? order
      : (await prisma.campaignScenario.count({ where: { campaignId } })); // ajouté à la suite par défaut

  const link = await prisma.campaignScenario.upsert({
    where: { campaignId_scenarioId: { campaignId, scenarioId } },
    create: { campaignId, scenarioId, order: resolvedOrder },
    update: { order: resolvedOrder },
  });

  return NextResponse.json(link, { status: 201 });
}
