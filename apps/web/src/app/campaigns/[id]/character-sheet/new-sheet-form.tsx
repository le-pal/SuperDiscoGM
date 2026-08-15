"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Formulaire de création à la première participation — gap non couvert par la spec [Q31]
// (seule la mise à jour en jeu par le MJ-IA est spécifiée), même hypothèse que l'API
// (apps/web/src/app/api/campaigns/[id]/character-sheet/route.ts) : nom, race, classe, PV max.
export function NewSheetForm({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [race, setRace] = useState("");
  const [className, setClassName] = useState("");
  const [hpMax, setHpMax] = useState(10);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!name.trim() || !race.trim() || !className.trim()) {
      setError("Nom, race et classe sont requis.");
      return;
    }
    if (hpMax <= 0) {
      setError("Les points de vie max doivent être supérieurs à 0.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/character-sheet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), race: race.trim(), className: className.trim(), hpMax }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Échec de la création, réessaie.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h3>Créer votre personnage</h3>
      <p className="muted" style={{ fontSize: ".85rem", marginBottom: 14 }}>
        Aucune fiche pour cette campagne pour l&apos;instant — un personnage par campagne [Q47].
      </p>
      <form onSubmit={submit} className="flex" style={{ flexDirection: "column", gap: 10 }}>
        <input type="text" placeholder="Nom du personnage" value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
        <input type="text" placeholder="Race" value={race} onChange={(e) => setRace(e.target.value)} disabled={saving} />
        <input type="text" placeholder="Classe" value={className} onChange={(e) => setClassName(e.target.value)} disabled={saving} />
        <label className="muted" style={{ fontSize: ".82rem" }}>
          Points de vie max
          <input
            type="number"
            min={1}
            value={hpMax}
            onChange={(e) => setHpMax(Number(e.target.value))}
            disabled={saving}
            style={{ display: "block", marginTop: 4 }}
          />
        </label>
        <button type="submit" className="btn primary small" disabled={saving}>
          Créer
        </button>
        {error && <span className="faint" style={{ color: "#d64550" }}>{error}</span>}
      </form>
    </div>
  );
}
