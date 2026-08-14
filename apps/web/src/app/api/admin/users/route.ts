import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { checkRole } from "@/server/authz";

// Gestion des utilisateurs réservée Admin [Q04] — pas d'héritage plus bas, contrairement à la
// plupart des autres droits (voir doc/admin/spec.md : c'est un droit propre à l'Admin).
export async function GET() {
  const user = await checkRole("ADMIN");
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, avatarColor: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(users);
}
