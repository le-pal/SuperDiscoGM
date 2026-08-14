import { redirect } from "next/navigation";
import type { Role, User } from "@superdiscogm/db";
import { getCurrentUser } from "./auth";

// Hiérarchie à héritage strict [Q04] : chaque rôle a tous les droits des rôles en dessous.
const ROLE_RANK: Record<Role, number> = {
  SPECTATOR: 0,
  USER: 1,
  SUPER_USER: 2,
  ADMIN: 3,
};

export function hasRole(user: Pick<User, "role">, minRole: Role): boolean {
  return ROLE_RANK[user.role] >= ROLE_RANK[minRole];
}

/** À utiliser dans les Server Components/pages : redirige vers /login si non connecté. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Idem, mais exige au moins le rôle donné (héritage strict [Q04]) — sinon 403 via notFound-like redirect. */
export async function requireRole(minRole: Role): Promise<User> {
  const user = await requireUser();
  if (!hasRole(user, minRole)) redirect("/");
  return user;
}

/**
 * Variante pour les Route Handlers (pas de redirect() disponible) : retourne l'utilisateur
 * ou null si l'appelant n'a pas le rôle minimum requis, à l'appelant de renvoyer 401/403.
 */
export async function checkRole(minRole: Role): Promise<User | null> {
  const user = await getCurrentUser();
  if (!user || !hasRole(user, minRole)) return null;
  return user;
}
