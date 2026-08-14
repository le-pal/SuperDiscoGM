import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { requireUser } from "@/server/authz";
import { AVATAR_COLORS } from "@/lib/avatar";

// Avatar V1 : bibliothèque prédéfinie, couleur + initiales déduites du nom [Q50] — l'utilisateur
// ne peut choisir que dans AVATAR_COLORS, jamais une couleur arbitraire (garde l'identité visuelle
// cohérente avec le design system, cf globals.css --p1..--p4).
export async function PATCH(request: Request) {
  const user = await requireUser();
  const { avatarColor } = await request.json();

  if (typeof avatarColor !== "string" || !AVATAR_COLORS.includes(avatarColor as (typeof AVATAR_COLORS)[number])) {
    return NextResponse.json({ error: "Couleur d'avatar invalide." }, { status: 400 });
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data: { avatarColor } });
  return NextResponse.json({ id: updated.id, avatarColor: updated.avatarColor });
}
