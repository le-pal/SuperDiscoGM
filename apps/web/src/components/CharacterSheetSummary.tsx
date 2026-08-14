import type { CharacterSheetView } from "@/lib/characterSheet";

// Panneau fiche condensée (étape 29) — destiné à la sidebar de l'écran de partie (étape 41) :
// juste de quoi situer son personnage en un coup d'œil pendant qu'on joue, la fiche complète
// (étape 28) reste la référence pour le détail (inventaire, sorts, journal).
export function CharacterSheetSummary({ sheet }: { sheet: CharacterSheetView }) {
  const pct = sheet.hpMax > 0 ? Math.max(0, Math.min(100, Math.round((sheet.hp / sheet.hpMax) * 100))) : 0;

  return (
    <div className="card">
      <h3>{sheet.name}</h3>
      <p className="muted" style={{ fontSize: ".82rem" }}>
        {sheet.race} {sheet.className} · Niveau {sheet.level}
      </p>
      <div className="pv-bar" style={{ height: 10, margin: "8px 0" }}>
        <div style={{ width: `${pct}%` }} />
      </div>
      <div className="muted" style={{ fontSize: ".78rem" }}>
        {sheet.hp} / {sheet.hpMax} PV · CA {sheet.ac}
      </div>
      {sheet.conditions.length > 0 && (
        <div className="flex gap-8 wrap" style={{ marginTop: 8 }}>
          {sheet.conditions.map((c) => (
            <span key={c} className="badge tag">{c}</span>
          ))}
        </div>
      )}
    </div>
  );
}
