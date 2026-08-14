"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PromptVersionRow {
  id: string;
  content: string;
  createdAt: string;
  createdBy: { name: string };
}

// Prompt système global [Q09], composé PAR-DESSUS les personas [Q24], jamais remplacé par elles.
// Versionné avec retour arrière (demande explicite de Philippe, étape 50) : chaque entrée de
// l'historique est la valeur REMPLACÉE au moment d'une modification (journal "undo") — restaurer
// réapplique son contenu via le même PATCH, ce qui journalise à son tour la valeur courante
// (un "redo" reste donc possible juste après un retour arrière).
export function SystemPromptEditor({
  initialPrompt,
  history,
}: {
  initialPrompt: string;
  history: PromptVersionRow[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialPrompt);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  async function save(content: string) {
    if (saving) return;
    setSaving(true);
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemPrompt: content }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="card" style={{ gridColumn: "span 2" }}>
      <h3>Prompt système global</h3>
      <p className="muted" style={{ fontSize: ".82rem" }}>
        S&apos;applique à toutes les parties de l&apos;instance. Les personas MJ viennent se composer par-dessus, jamais le remplacer.
      </p>
      <textarea style={{ minHeight: 140 }} value={value} onChange={(e) => setValue(e.target.value)} disabled={saving} />
      <div className="flex between" style={{ marginTop: 10 }}>
        <button type="button" className="btn ghost small" onClick={() => setShowHistory((v) => !v)}>
          {showHistory ? "Masquer l'historique" : `Historique (${history.length})`}
        </button>
        <button type="button" className="btn primary small" onClick={() => save(value)} disabled={saving}>
          Enregistrer
        </button>
      </div>

      {showHistory && (
        <div style={{ marginTop: 12 }}>
          {history.length === 0 ? (
            <p className="faint" style={{ fontSize: ".78rem" }}>Aucune version antérieure enregistrée.</p>
          ) : (
            history.map((v) => (
              <div key={v.id} className="flex between" style={{ padding: "6px 0", borderTop: "1px solid var(--border, #333)" }}>
                <div>
                  <p className="muted" style={{ fontSize: ".78rem", margin: 0 }}>
                    {new Date(v.createdAt).toLocaleString("fr-FR")} · {v.createdBy.name}
                  </p>
                  <p className="faint" style={{ fontSize: ".75rem", maxWidth: 480, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {v.content}
                  </p>
                </div>
                <button type="button" className="btn small ghost" onClick={() => save(v.content)} disabled={saving}>
                  Restaurer
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
