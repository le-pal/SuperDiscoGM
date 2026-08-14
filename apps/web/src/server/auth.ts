import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import type { User } from "@superdiscogm/db";
import { SESSION_COOKIE, createSessionRecord, deleteSessionByToken, getUserByToken } from "./session";

// Auth maison — pas de next-auth (v5 en beta depuis fin 2023, cadence en ralentissement,
// voir doc/technique/questions.md [Q38]). Session opaque en DB, seul le hash du token est
// stocké (une fuite de la table Session ne donne pas de token valide directement).
//
// Ce fichier est le SEUL point d'entrée next/headers de la couche auth — voir session.ts pour
// pourquoi ça compte (ne pas réimporter next/headers ailleurs sans relire ce commentaire).

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const { token, expiresAt } = await createSessionRecord(userId);

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
  if (token) await deleteSessionByToken(token);
  jar.delete(SESSION_COOKIE);
}

/** Lecture DB systématique — pas de confiance dans le seul cookie (voir proxy.ts pour le garde léger). */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getUserByToken(token);
}
