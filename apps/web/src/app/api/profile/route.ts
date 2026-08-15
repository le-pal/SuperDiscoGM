import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { requireUser } from "@/server/authz";
import { AVATAR_COLORS } from "@/lib/avatar";

const MAX_INITIALS_LENGTH = 3;

// Avatar V1 : bibliothèque prédéfinie de couleurs [Q50] — l'utilisateur ne peut choisir que dans
// AVATAR_COLORS, jamais une couleur arbitraire (garde l'identité visuelle cohérente avec le
// design system, cf globals.css --p1..--p4). Nom affiché et initiales personnalisables [Q54] —
// avatarInitials vide/absent = retour à la déduction automatique du nom (comportement par défaut).
export async function PATCH(request: Request) {
  const user = await requireUser();
  const body = await request.json();
  const data: { avatarColor?: string; name?: string; avatarInitials?: string | null } = {};

  if (body.avatarColor !== undefined) {
    if (typeof body.avatarColor !== "string" || !AVATAR_COLORS.includes(body.avatarColor as (typeof AVATAR_COLORS)[number])) {
      return NextResponse.json({ error: "Couleur d'avatar invalide." }, { status: 400 });
    }
    data.avatarColor = body.avatarColor;
  }

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json({ error: "Nom invalide." }, { status: 400 });
    }
    data.name = body.name.trim();
  }

  if (body.avatarInitials !== undefined) {
    const trimmed = typeof body.avatarInitials === "string" ? body.avatarInitials.trim() : "";
    data.avatarInitials = trimmed.length > 0 ? trimmed.slice(0, MAX_INITIALS_LENGTH).toUpperCase() : null;
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data });
  return NextResponse.json({ id: updated.id, name: updated.name, avatarColor: updated.avatarColor, avatarInitials: updated.avatarInitials });
}
