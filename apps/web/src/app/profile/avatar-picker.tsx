"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AVATAR_COLORS } from "@/lib/avatar";

interface AvatarPickerProps {
  currentColor: string;
  initials: string;
}

// Sélection dans la bibliothèque prédéfinie V1 [Q50] — pas d'upload d'image (réservé V2+, cf
// maquette/profil.html §"Image personnalisée"). Enregistrement immédiat au clic, pas de bouton
// "Enregistrer" séparé : une seule action, pas d'état de brouillon à gérer. `initials` vient déjà
// résolu du parent (surcharge [Q54] ou déduction auto) pour prévisualiser fidèlement les swatches.
export function AvatarPicker({ currentColor, initials }: AvatarPickerProps) {
  const router = useRouter();
  const [color, setColor] = useState(currentColor);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(next: string) {
    if (next === color || saving) return;
    setSaving(next);
    setError(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarColor: next }),
    });
    setSaving(null);
    if (!res.ok) {
      setError("Échec de l'enregistrement, réessaie.");
      return;
    }
    setColor(next);
    router.refresh();
  }

  return (
    <div>
      <div className="avatar-grid">
        {AVATAR_COLORS.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className={`avatar-option${swatch === color ? " selected" : ""}`}
            style={{ background: swatch, opacity: saving && saving !== swatch ? 0.5 : 1 }}
            disabled={saving !== null}
            onClick={() => pick(swatch)}
            aria-label={`Choisir la couleur ${swatch}`}
          >
            {initials}
          </button>
        ))}
      </div>
      {error && (
        <p className="faint" style={{ color: "var(--danger, #d64550)", marginTop: 8 }}>
          {error}
        </p>
      )}
    </div>
  );
}
