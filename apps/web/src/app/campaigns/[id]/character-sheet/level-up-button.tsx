"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Montée de niveau : reste du ressort du joueur [Q31], pas un tool-call MJ-IA (contrairement aux
// dégâts/soins/objets) — cf apps/web/src/app/api/character-sheets/[id]/level-up/route.ts.
export function LevelUpButton({ sheetId }: { sheetId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hpGain, setHpGain] = useState(6);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" className="btn ghost small" onClick={() => setOpen(true)}>
        Monter de niveau
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || hpGain <= 0) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/character-sheets/${sheetId}/level-up`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hpGain }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Échec, réessaie.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex center gap-8">
      <label className="muted" style={{ fontSize: ".82rem" }}>
        Gain de PV max
        <input
          type="number"
          min={1}
          value={hpGain}
          onChange={(e) => setHpGain(Number(e.target.value))}
          disabled={saving}
          style={{ marginLeft: 6, width: 64 }}
        />
      </label>
      <button type="submit" className="btn primary small" disabled={saving}>Confirmer</button>
      <button type="button" className="btn ghost small" onClick={() => setOpen(false)} disabled={saving}>Annuler</button>
      {error && <span className="faint" style={{ color: "#d64550" }}>{error}</span>}
    </form>
  );
}
