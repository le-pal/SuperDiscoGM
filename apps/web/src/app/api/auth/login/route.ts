import { NextResponse } from "next/server";
import { prisma } from "@superdiscogm/db";
import { verifyPassword, createSession } from "@/server/auth";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Message générique volontaire : ne pas révéler si c'est l'email ou le mot de passe qui cloche.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Identifiants invalides." }, { status: 401 });
  }

  await createSession(user.id);

  return NextResponse.json({ ok: true });
}
