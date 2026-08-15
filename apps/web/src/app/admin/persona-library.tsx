"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PersonaRow {
  id: string;
  name: string;
  genreTag: string;
  systemPromptFragment: string;
  usedBy: string[];
}

// Bibliothèque globale réutilisable, gérée par Super utilisateur+ [Q06] — surchargeable au
// niveau campagne/scénario (résolution par spécificité, cf apps/web/src/server/persona.ts).
export function PersonaLibrary({ personas }: { personas: PersonaRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [genreTag, setGenreTag] = useState("");
  const [fragment, setFragment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      setError("Le nom de la persona est requis.");
      return;
    }
    if (!fragment.trim()) {
      setError("Le fragment de prompt est requis.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), genreTag: genreTag.trim() || "Non classé", systemPromptFragment: fragment.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Échec de la création, réessaie.");
      return;
    }
    setCreating(false);
    setName("");
    setGenreTag("");
    setFragment("");
    router.refresh();
  }

  return (
    <div>
      <div className="card-grid">
        {personas.map((p) => (
          <div key={p.id} className="card">
            <span className="badge tag">{p.genreTag}</span>
            <h3 style={{ marginTop: 10 }}>{p.name}</h3>
            <p className="muted" style={{ fontSize: ".82rem" }}>{p.systemPromptFragment}</p>
            {p.usedBy.length > 0 && (
              <p className="faint" style={{ fontSize: ".72rem", marginTop: 6 }}>Utilisée par : {p.usedBy.join(", ")}</p>
            )}
          </div>
        ))}

        {creating ? (
          <form onSubmit={submit} className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input type="text" placeholder="Nom de la persona" value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
            <input type="text" placeholder="Genre (ex: Fantasy épique)" value={genreTag} onChange={(e) => setGenreTag(e.target.value)} disabled={saving} />
            <textarea
              placeholder="Fragment de prompt (composé par-dessus le prompt système global)"
              value={fragment}
              onChange={(e) => setFragment(e.target.value)}
              disabled={saving}
              style={{ minHeight: 80 }}
            />
            <div className="flex gap-8">
              <button type="submit" className="btn primary small" disabled={saving}>Créer</button>
              <button type="button" className="btn ghost small" onClick={() => setCreating(false)} disabled={saving}>Annuler</button>
            </div>
            {error && <span className="faint" style={{ color: "#d64550" }}>{error}</span>}
          </form>
        ) : (
          <button
            type="button"
            className="card"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", borderStyle: "dashed", color: "var(--text-muted)", cursor: "pointer" }}
            onClick={() => setCreating(true)}
          >
            + Nouvelle persona
          </button>
        )}
      </div>
      <p className="faint" style={{ fontSize: ".75rem", marginTop: 10 }}>
        Bibliothèque globale réutilisable, avec surcharge possible au niveau campagne ou scénario (priorité : scénario &gt; campagne &gt; persona globale).
      </p>
    </div>
  );
}
