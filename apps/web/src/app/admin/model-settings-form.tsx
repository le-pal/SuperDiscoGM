"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PROVIDERS = ["anthropic", "openai", "ollama"] as const;

// Architecture multi-fournisseurs [Q37] : le modèle est un identifiant texte libre (pas un enum
// figé côté UI) — la liste des modèles disponibles varie trop souvent par fournisseur pour être
// codée en dur ici sans risquer de devenir fausse. Coût des appels : budget global géré par
// l'Admin [Q03] ; le consommé réel (étape 48, UsageLog) est en USD (tarifs fournisseurs
// usuellement libellés ainsi) alors que le plafond saisi ici est en € — pas de conversion de
// change en V1, les deux chiffres restent volontairement affichés dans leur devise d'origine
// plutôt que de faire semblant d'une parité qui n'existe pas.
export function ModelSettingsForm({
  activeProvider,
  activeModel,
  monthlyBudget,
  usageThisMonth,
}: {
  activeProvider: string;
  activeModel: string;
  monthlyBudget: number | null;
  usageThisMonth: { costUsd: number | null; inputTokens: number; outputTokens: number };
}) {
  const router = useRouter();
  const [provider, setProvider] = useState(activeProvider);
  const [model, setModel] = useState(activeModel);
  const [budget, setBudget] = useState(monthlyBudget ?? 0);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    setSaving(true);
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeProvider: provider, activeModel: model, monthlyBudget: budget }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="card">
      <h3>Modèles LLM</h3>
      <p className="muted" style={{ fontSize: ".82rem" }}>Architecture multi-fournisseurs, budget global.</p>
      <div className="field">
        <label>Fournisseur actif</label>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} disabled={saving}>
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Modèle</label>
        <input type="text" value={model} onChange={(e) => setModel(e.target.value)} disabled={saving} />
      </div>
      <div className="field">
        <label>Budget mensuel (€)</label>
        <input type="number" min={0} step={1} value={budget} onChange={(e) => setBudget(Number(e.target.value))} disabled={saving} />
      </div>
      <div className="flex between" style={{ fontSize: ".8rem", marginBottom: 14 }}>
        <span className="muted">Consommé ce mois-ci</span>
        <span style={{ fontWeight: 700, color: "var(--accent)" }}>
          {usageThisMonth.costUsd !== null ? `$${usageThisMonth.costUsd.toFixed(2)}` : "tarif inconnu"}
          <span className="faint" style={{ fontWeight: 400, marginLeft: 6 }}>
            ({usageThisMonth.inputTokens.toLocaleString("fr-FR")} / {usageThisMonth.outputTokens.toLocaleString("fr-FR")} tokens in/out)
          </span>
        </span>
      </div>
      <div className="flex" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn primary small" onClick={save} disabled={saving}>
          Enregistrer
        </button>
      </div>
    </div>
  );
}
