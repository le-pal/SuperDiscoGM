"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MAX_INITIALS_LENGTH = 3;

// Nom affiché + surcharge des initiales [Q54] — initiales vides = retour à la déduction
// automatique du nom (comportement par défaut inchangé, cf lib/avatar.ts resolveInitials()).
export function IdentityForm({ initialName, initialCustomInitials }: { initialName: string; initialCustomInitials: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [customInitials, setCustomInitials] = useState(initialCustomInitials);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || name.trim().length === 0) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), avatarInitials: customInitials.trim() || null }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Échec de l'enregistrement, réessaie.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex" style={{ flexDirection: "column", gap: 10, marginBottom: 16 }}>
      <label className="muted" style={{ fontSize: ".82rem" }}>
        Nom affiché
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={saving} style={{ display: "block", marginTop: 4 }} />
      </label>
      <label className="muted" style={{ fontSize: ".82rem" }}>
        Initiales (facultatif — sinon déduites automatiquement du nom)
        <input
          type="text"
          value={customInitials}
          onChange={(e) => setCustomInitials(e.target.value.slice(0, MAX_INITIALS_LENGTH).toUpperCase())}
          placeholder="Ex : PH"
          maxLength={MAX_INITIALS_LENGTH}
          disabled={saving}
          style={{ display: "block", marginTop: 4, width: 100 }}
        />
      </label>
      <div className="flex" style={{ justifyContent: "flex-end" }}>
        <button type="submit" className="btn primary small" disabled={saving}>
          Enregistrer
        </button>
      </div>
      {error && <p className="faint" style={{ color: "#d64550" }}>{error}</p>}
    </form>
  );
}
