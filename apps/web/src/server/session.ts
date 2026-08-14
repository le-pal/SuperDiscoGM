import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@superdiscogm/db";
import type { User } from "@superdiscogm/db";

// Logique de session pure DB — AUCUN import de next/headers ici, volontairement. socket.ts en
// dépend, et server.ts importe socket.ts avant même d'appeler next({dev}) : si ce module
// chargeait next/headers, ça tirerait des internals Next (app-render/*) avant que next() ait
// initialisé son AsyncLocalStorage global, et ça fait planter le serveur entier au démarrage
// ("Invariant: AsyncLocalStorage accessed in runtime where it is not available") — rencontré
// en pratique. auth.ts (qui a besoin de cookies()) est le seul consommateur de next/headers.

export const SESSION_COOKIE = "session";
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSessionRecord(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await prisma.session.create({ data: { userId, tokenHash, expiresAt } });
  return { token, expiresAt };
}

export async function deleteSessionByToken(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/** Utilisé par getCurrentUser() (auth.ts, via cookie) et par le handshake Socket.IO (socket.ts, via header). */
export async function getUserByToken(token: string): Promise<User | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}
