"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Portage du bouton "+ Nouvelle campagne" (maquette/dashboard.html) — Super utilisateur [Q05].
export function NewCampaignForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <div className="flex gap-8">
        <button type="button" className="btn primary small" onClick={() => setOpen(true)}>
          + Nouvelle campagne
        </button>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length === 0 || saving) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Échec de la création, réessaie.");
      return;
    }
    setOpen(false);
    setName("");
    router.refresh();
  }

  return (
    <form className="flex gap-8" onSubmit={submit}>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nom de la campagne"
        autoFocus
        disabled={saving}
      />
      <button type="submit" className="btn primary small" disabled={saving}>
        Créer
      </button>
      <button type="button" className="btn ghost small" onClick={() => setOpen(false)} disabled={saving}>
        Annuler
      </button>
      {error && <span className="faint" style={{ color: "#d64550" }}>{error}</span>}
    </form>
  );
}
