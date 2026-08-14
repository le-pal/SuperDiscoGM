import { redirect } from "next/navigation";
import type { Role, User } from "@superdiscogm/db";
import { getCurrentUser } from "./auth";
import { hasRole } from "@/lib/roles";

export { hasRole };

/** À utiliser dans les Server Components/pages : redirige vers /login si non connecté. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Idem, mais exige au moins le rôle donné (héritage strict [Q04]) — sinon redirige. */
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
