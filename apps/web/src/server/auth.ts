import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@superdiscogm/db";
import type { User } from "@superdiscogm/db";

// Auth maison — pas de next-auth (v5 en beta depuis fin 2023, cadence en ralentissement,
// voir doc/technique/questions.md [Q38]). Session opaque en DB, seul le hash du token est
// stocké (une fuite de la table Session ne donne pas de token valide directement).

const SESSION_COOKIE = "session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({ data: { userId, tokenHash, expiresAt } });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(SESSION_COOKIE);
}

/** Lecture DB systématique — pas de confiance dans le seul cookie (voir proxy.ts pour le garde léger). */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getUserByToken(token);
}

/**
 * Même vérification que getCurrentUser(), mais sans dépendre de next/headers — utilisable
 * depuis le handshake Socket.IO (server.ts/socket.ts), qui n'a pas accès à l'API cookies()
 * réservée aux Server Components/Route Handlers.
 */
export async function getUserByToken(token: string): Promise<User | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export { SESSION_COOKIE };
