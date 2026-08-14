"use client";

import { useState } from "react";
import { CharacterSheetSummary } from "@/components/CharacterSheetSummary";
import type { CharacterSheetView } from "@/lib/characterSheet";

type Tab = "sheet" | "notes";

// Sidebar (portage maquette/ecran-partie.html) — fiche condensée (étape 29, CharacterSheetSummary
// déjà construit) + bloc-notes privé (étape 46, jamais lu par le MJ-IA ni les autres joueurs [Q46]).
export function PartySidebar({
  campaignId,
  sheet,
  initialNotes,
}: {
  campaignId: string;
  sheet: CharacterSheetView | null;
  initialNotes: string;
}) {
  const [tab, setTab] = useState<Tab>("sheet");
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);

  async function saveNotes() {
    if (saving) return;
    setSaving(true);
    await fetch(`/api/campaigns/${campaignId}/notes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: notes }),
    });
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className="partie-sidebar">
      <div className="tabs">
        <div className={`tab${tab === "sheet" ? " active" : ""}`} style={{ cursor: "pointer" }} onClick={() => setTab("sheet")}>
          Fiche perso
        </div>
        <div className={`tab${tab === "notes" ? " active" : ""}`} style={{ cursor: "pointer" }} onClick={() => setTab("notes")}>
          Bloc-notes 🔒
        </div>
      </div>

      {tab === "sheet" ? (
        sheet ? (
          <>
            <CharacterSheetSummary sheet={sheet} />
            <a
              href={`/campaigns/${campaignId}/character-sheet`}
              className="btn small ghost"
              style={{ width: "100%", justifyContent: "center", marginTop: 12 }}
            >
              Voir la fiche complète →
            </a>
          </>
        ) : (
          <div>
            <p className="muted" style={{ fontSize: ".85rem" }}>Aucune fiche pour cette campagne.</p>
            <a href={`/campaigns/${campaignId}/character-sheet`} className="btn small primary" style={{ width: "100%", justifyContent: "center" }}>
              Créer mon personnage
            </a>
          </div>
        )
      ) : (
        <div>
          <p className="faint" style={{ fontSize: ".72rem", marginBottom: 8 }}>
            Jamais lu par le MJ-IA ni les autres joueurs — privé, propre à cette campagne.
          </p>
          <textarea
            style={{ minHeight: 300 }}
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setSaved(false);
            }}
          />
          <div className="flex" style={{ justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" className="btn small primary" onClick={saveNotes} disabled={saving || saved}>
              {saved ? "Enregistré" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
