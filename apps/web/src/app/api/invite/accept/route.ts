import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { hashPassword, createSession } from "@/server/auth";

// Accepte une invitation [Q38] : crée le compte avec le rôle porté par l'invitation, sans que
// l'Admin ait à créer chaque compte manuellement. Ne crée pas de participation à une partie —
// ça reste une action séparée ("rejoindre") une fois connecté.
export async function POST(request: Request) {
  const { token, email, name, password } = await request.json();

  if (
    typeof token !== "string" ||
    typeof email !== "string" ||
    typeof name !== "string" ||
    typeof password !== "string" ||
    password.length < 8
  ) {
    return NextResponse.json({ error: "Requête invalide (mot de passe : 8 caractères minimum)." }, { status: 400 });
  }

  const invitation = await prisma.invitation.findUnique({ where: { token } });

  if (!invitation || invitation.usedAt || invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invitation invalide ou expirée." }, { status: 410 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Un compte existe déjà avec cet email." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const avatarColor = ["#5b8dee", "#52b788", "#f4a259", "#9b6bce"][Math.floor(Math.random() * 4)];

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email, name, passwordHash, role: invitation.role, avatarColor },
    });
    await tx.invitation.update({ where: { id: invitation.id }, data: { usedAt: new Date(), usedById: created.id } });
    return created;
  });

  await createSession(user.id);

  return NextResponse.json({ ok: true });
}
