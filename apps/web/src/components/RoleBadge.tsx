import type { Role } from "@superdiscogm/db";

const ROLE_META: Record<Role, { className: string; label: string }> = {
  ADMIN: { className: "badge role-admin", label: "Admin" },
  SUPER_USER: { className: "badge role-super", label: "Super utilisateur" },
  USER: { className: "badge role-user", label: "Utilisateur" },
  SPECTATOR: { className: "badge role-spectateur", label: "Spectateur" },
};

export function RoleBadge({ role }: { role: Role }) {
  const meta = ROLE_META[role];
  return <span className={meta.className}>{meta.label}</span>;
}
