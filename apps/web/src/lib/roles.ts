import type { Role, User } from "@superdiscogm/db";

// Hiérarchie à héritage strict [Q04] : chaque rôle a tous les droits des rôles en dessous.
// Module pur (pas d'import next/headers) — utilisable aussi bien côté client (TopNav) que serveur (authz.ts).
const ROLE_RANK: Record<Role, number> = {
  SPECTATOR: 0,
  USER: 1,
  SUPER_USER: 2,
  ADMIN: 3,
};

export function hasRole(user: Pick<User, "role">, minRole: Role): boolean {
  return ROLE_RANK[user.role] >= ROLE_RANK[minRole];
}
