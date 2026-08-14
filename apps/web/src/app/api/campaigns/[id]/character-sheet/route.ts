import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { requireUser } from "@/server/authz";

// Création de personnage — gap non couvert par la spec fonctionnelle (seule la mise à jour en
// jeu par le MJ-IA est spécifiée [Q31]) : hypothèse minimale, cohérente avec la fiche
// simplifiée [Q30] et une fiche par campagne [Q47]. Formulaire joueur à la première
// participation : nom, race, classe, PV max, caractéristiques de base.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: campaignId } = await params;

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });

  const existing = await prisma.characterSheet.findUnique({
    where: { userId_campaignId: { userId: user.id, campaignId } },
  });
  if (existing) {
    return NextResponse.json({ error: "Une fiche existe déjà pour cette campagne." }, { status: 409 });
  }

  const { name, className, race, hpMax, stats } = await request.json();
  if (
    typeof name !== "string" ||
    typeof className !== "string" ||
    typeof race !== "string" ||
    typeof hpMax !== "number" ||
    hpMax <= 0
  ) {
    return NextResponse.json({ error: "name, className, race et hpMax (> 0) sont requis." }, { status: 400 });
  }

  const sheet = await prisma.characterSheet.create({
    data: {
      userId: user.id,
      campaignId,
      name,
      className,
      race,
      hp: hpMax,
      hpMax,
      stats: stats && typeof stats === "object" ? stats : {},
      inventory: [],
    },
  });

  return NextResponse.json(sheet, { status: 201 });
}

// Lecture de SA PROPRE fiche pour cette campagne — la vue table (Super utilisateur/MJ) est
// GET /api/campaigns/:id/character-sheets (pluriel), route séparée.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: campaignId } = await params;

  const sheet = await prisma.characterSheet.findUnique({
    where: { userId_campaignId: { userId: user.id, campaignId } },
    include: { logs: { orderBy: { createdAt: "desc" }, take: 20 } },
  });

  if (!sheet) return NextResponse.json({ error: "Aucune fiche pour cette campagne." }, { status: 404 });
  return NextResponse.json(sheet);
}
