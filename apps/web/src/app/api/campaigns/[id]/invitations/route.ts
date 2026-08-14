import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma, type Role } from "@superdiscogm/db";
import { checkRole } from "@/server/authz";

const VALID_ROLES: Role[] = ["ADMIN", "SUPER_USER", "USER", "SPECTATOR"];
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

// Émission d'invitation [Q38] — Super utilisateur (Admin par héritage) [Q05]. Le lien généré
// (contenant le token) est à copier/partager manuellement ; /invite/[token] côté client
// consomme déjà ce token (route d'acceptation existante, voir api/invite/accept).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkRole("SUPER_USER");
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { id: campaignId } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });

  const { role } = await request.json();
  const targetRole: Role = typeof role === "string" && VALID_ROLES.includes(role as Role) ? (role as Role) : "USER";

  const invitation = await prisma.invitation.create({
    data: {
      token: randomBytes(24).toString("base64url"),
      campaignId,
      invitedById: user.id,
      role: targetRole,
      expiresAt: new Date(Date.now() + EXPIRY_MS),
    },
  });

  return NextResponse.json(invitation, { status: 201 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkRole("SUPER_USER");
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { id: campaignId } = await params;
  const invitations = await prisma.invitation.findMany({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invitations);
}
