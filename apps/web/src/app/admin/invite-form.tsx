"use client";

import { useState } from "react";
import type { Role } from "@superdiscogm/db";

const ROLES: Role[] = ["USER", "SPECTATOR", "SUPER_USER"];

// Émission d'invitation [Q38] — le lien généré est à copier/partager manuellement, pas d'envoi
// d'email en V1 (cf apps/web/src/app/api/campaigns/[id]/invitations/route.ts). Scopée à une
// campagne : l'invitation donne accès à une table précise, pas à l'instance entière.
export function InviteForm({ campaigns }: { campaigns: { id: string; name: string }[] }) {
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [role, setRole] = useState<Role>("USER");
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (campaigns.length === 0) {
    return <p className="muted" style={{ fontSize: ".82rem" }}>Créez d&apos;abord une campagne pour pouvoir y inviter quelqu&apos;un.</p>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !campaignId) return;
    setSaving(true);
    setError(null);
    setLink(null);
    const res = await fetch(`/api/campaigns/${campaignId}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Échec de la création, réessaie.");
      return;
    }
    const invitation = await res.json();
    setLink(`${window.location.origin}/invite/${invitation.token}`);
  }

  return (
    <form onSubmit={submit} className="flex gap-8 wrap" style={{ alignItems: "center" }}>
      <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} disabled={saving}>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <select value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={saving}>
        {ROLES.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <button type="submit" className="btn primary small" disabled={saving}>
        + Inviter
      </button>
      {link && (
        <span className="faint" style={{ fontSize: ".78rem" }}>
          Lien : <code>{link}</code>
        </span>
      )}
      {error && <span className="faint" style={{ color: "#d64550" }}>{error}</span>}
    </form>
  );
}
