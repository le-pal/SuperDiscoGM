"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@superdiscogm/db";
import { RoleBadge } from "@/components/RoleBadge";

const ROLES: Role[] = ["ADMIN", "SUPER_USER", "USER", "SPECTATOR"];

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
}

// Gestion des utilisateurs réservée Admin [Q04], pas d'héritage plus bas ici (contrairement à
// la plupart des autres droits) — cf apps/web/src/app/api/admin/users/[id]/route.ts.
export function UsersTable({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, setPending] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(userId: string) {
    if (!pending || saving) return;
    setSaving(true);
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: pending }),
    });
    setSaving(false);
    setEditing(null);
    router.refresh();
  }

  return (
    <div className="card">
      <table>
        <thead>
          <tr><th>Nom</th><th>Email</th><th>Rôle</th><th></th></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>
                {editing === u.id ? (
                  <select value={pending ?? u.role} onChange={(e) => setPending(e.target.value as Role)}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                ) : (
                  <RoleBadge role={u.role} />
                )}
              </td>
              <td>
                {editing === u.id ? (
                  <div className="flex gap-8">
                    <button type="button" className="btn small primary" onClick={() => save(u.id)} disabled={saving}>
                      Enregistrer
                    </button>
                    <button type="button" className="btn small ghost" onClick={() => setEditing(null)} disabled={saving}>
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn small ghost"
                    onClick={() => {
                      setEditing(u.id);
                      setPending(u.role);
                    }}
                  >
                    Modifier
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="faint" style={{ fontSize: ".75rem", marginTop: 10 }}>
        Hiérarchie à héritage strict : Admin ⊃ Super utilisateur ⊃ Utilisateur ⊃ Spectateur.
      </p>
    </div>
  );
}
