import { NextResponse } from "next/server";
import { prisma, type Role } from "@superdiscogm/db";
import { checkRole } from "@/server/authz";

const VALID_ROLES: Role[] = ["ADMIN", "SUPER_USER", "USER", "SPECTATOR"];

// Changer le rôle système d'un utilisateur [Q04] — réservé Admin.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await checkRole("ADMIN");
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { id } = await params;
  const { role } = await request.json();

  if (typeof role !== "string" || !VALID_ROLES.includes(role as Role)) {
    return NextResponse.json({ error: `Rôle invalide (attendu : ${VALID_ROLES.join(", ")}).` }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });

  const updated = await prisma.user.update({
    where: { id },
    data: { role: role as Role },
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json(updated);
}
