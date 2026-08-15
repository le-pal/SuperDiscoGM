"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "paste" | "upload";

// Étape 1 · Contenu du scénario (portage maquette/ingestion-scenario.html) — texte collé [Q13]
// ou fichier PDF/docx/markdown, extrait puis fusionné côté serveur dans Scenario.rawContent
// (apps/web/src/app/api/scenarios/[id]/files/route.ts, étape 20). Images/cartes ignorées en V1.
export function NewScenarioForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("paste");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    if (!title.trim()) {
      setError("Le titre du scénario est requis.");
      return;
    }
    if (mode === "paste" && !content.trim()) {
      setError("Colle le texte du scénario avant de créer.");
      return;
    }
    if (mode === "upload" && !file) {
      setError("Choisis un fichier avant de créer.");
      return;
    }

    setSaving(true);
    setError(null);

    const createRes = await fetch("/api/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), rawContent: mode === "paste" ? content : undefined }),
    });
    if (!createRes.ok) {
      setSaving(false);
      setError("Échec de la création, réessaie.");
      return;
    }
    const scenario = await createRes.json();

    if (mode === "upload" && file) {
      const formData = new FormData();
      formData.append("file", file);
      const fileRes = await fetch(`/api/scenarios/${scenario.id}/files`, { method: "POST", body: formData });
      if (!fileRes.ok) {
        setSaving(false);
        setError("Scénario créé, mais échec de l'upload du fichier.");
        return;
      }
    }

    router.push(`/scenarios/${scenario.id}`);
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <input type="text" placeholder="Titre du scénario" value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} />
      </div>

      <div className="card">
        <div className="tabs">
          <div className={`tab${mode === "paste" ? " active" : ""}`} onClick={() => !saving && setMode("paste")} style={{ cursor: "pointer" }}>
            Coller le texte
          </div>
          <div className={`tab${mode === "upload" ? " active" : ""}`} onClick={() => !saving && setMode("upload")} style={{ cursor: "pointer" }}>
            Importer un fichier (PDF / docx / markdown)
          </div>
        </div>

        {mode === "paste" ? (
          <textarea
            style={{ minHeight: 220 }}
            placeholder="Collez le texte complet du scénario ici…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={saving}
          />
        ) : (
          <div className="upload-zone">
            <input
              type="file"
              accept=".pdf,.docx,.md,text/plain"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={saving}
            />
            <p className="faint" style={{ fontSize: ".78rem", marginTop: 8 }}>
              Images/cartes du fichier : ignorées en V1 (le pipeline est conçu pour les accueillir plus tard).
            </p>
          </div>
        )}
      </div>

      <div className="flex" style={{ marginTop: 14, justifyContent: "flex-end" }}>
        <button type="submit" className="btn primary small" disabled={saving}>
          {saving ? "Création…" : "Créer le scénario"}
        </button>
      </div>
      {error && <p className="faint" style={{ color: "#d64550" }}>{error}</p>}
    </form>
  );
}
