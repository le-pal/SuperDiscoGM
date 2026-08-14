import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { checkRole, requireUser } from "@/server/authz";

// Création de campagne réservée Super utilisateur (Admin par héritage) [Q05].
export async function POST(request: Request) {
  const user = await checkRole("SUPER_USER");
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { name } = await request.json();
  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Nom de campagne requis." }, { status: 400 });
  }

  const campaign = await prisma.campaign.create({ data: { name: name.trim(), createdById: user.id } });
  return NextResponse.json(campaign, { status: 201 });
}

// Admin voit toutes les campagnes ; Super utilisateur voit les siennes. La liste "campagnes
// rejointes" pour un simple Utilisateur/Spectateur arrive avec Party/PartyParticipant (étape 42).
export async function GET() {
  const user = await requireUser();

  const campaigns =
    user.role === "ADMIN"
      ? await prisma.campaign.findMany({ orderBy: { createdAt: "desc" } })
      : await prisma.campaign.findMany({
          where: { createdById: user.id },
          orderBy: { createdAt: "desc" },
        });

  return NextResponse.json(campaigns);
}
