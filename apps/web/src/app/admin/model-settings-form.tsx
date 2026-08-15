"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PROVIDERS = ["anthropic", "openai", "ollama", "openrouter"] as const;

interface CredentialInfo {
  hasApiKey: boolean;
  apiKeyLast4: string | null;
  baseUrl: string | null;
}

// Architecture multi-fournisseurs [Q37] : le modèle est un identifiant texte libre (pas un enum
// figé côté UI) — la liste des modèles disponibles varie trop souvent par fournisseur pour être
// codée en dur ici sans risquer de devenir fausse. Accès (clé API + endpoint) configurable par
// fournisseur depuis cette page — avant cet ajout, seule une variable d'env fixée au déploiement
// pouvait fournir une clé (demande explicite de Philippe : "on devrait pouvoir saisir un accès à
// OpenRouter"). La clé n'est jamais renvoyée en clair : seul un indicateur "configurée (…derniers
// chiffres)" est affiché, un champ vide au moment d'enregistrer laisse la clé existante inchangée.
export function ModelSettingsForm({
  activeProvider,
  activeModel,
  monthlyBudget,
  usageThisMonth,
  credentials,
}: {
  activeProvider: string;
  activeModel: string;
  monthlyBudget: number | null;
  usageThisMonth: { costUsd: number | null; inputTokens: number; outputTokens: number };
  credentials: Record<string, CredentialInfo>;
}) {
  const router = useRouter();
  const [provider, setProvider] = useState(activeProvider);
  const [model, setModel] = useState(activeModel);
  const [budget, setBudget] = useState(monthlyBudget ?? 0);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(credentials[provider]?.baseUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentCredential = credentials[provider];

  function onProviderChange(next: string) {
    setProvider(next);
    setApiKey("");
    setBaseUrl(credentials[next]?.baseUrl ?? "");
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);

    const [settingsRes, credentialRes] = await Promise.all([
      fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeProvider: provider, activeModel: model, monthlyBudget: budget }),
      }),
      // apiKey vide = ne touche pas à la clé existante ; baseUrl vide = efface un override existant.
      apiKey.trim() || baseUrl !== (credentials[provider]?.baseUrl ?? "")
        ? fetch("/api/admin/credentials", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}), baseUrl }),
          })
        : Promise.resolve(new Response(null, { status: 200 })),
    ]);

    setSaving(false);
    if (!settingsRes.ok || !credentialRes.ok) {
      setError("Échec de l'enregistrement, réessaie.");
      return;
    }
    setApiKey("");
    router.refresh();
  }

  return (
    <div className="card">
      <h3>Modèles LLM</h3>
      <p className="muted" style={{ fontSize: ".82rem" }}>Architecture multi-fournisseurs, budget global.</p>
      <div className="field">
        <label>Fournisseur actif</label>
        <select value={provider} onChange={(e) => onProviderChange(e.target.value)} disabled={saving}>
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
        <label>Clé API {provider}</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={currentCredential?.hasApiKey ? `Configurée (…${currentCredential.apiKeyLast4})` : "Non configurée"}
          disabled={saving}
        />
        <p className="faint" style={{ fontSize: ".72rem", marginTop: 4 }}>
          Laisser vide pour garder la clé actuelle. Sans clé ici, la variable d&apos;environnement du déploiement sert de repli.
        </p>
      </div>
      <div className="field">
        <label>Endpoint personnalisé (facultatif)</label>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="Laisser vide pour l'endpoint par défaut du fournisseur"
          disabled={saving}
        />
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
      <div className="flex" style={{ justifyContent: "flex-end", alignItems: "center", gap: 10 }}>
        {error && <span className="faint" style={{ color: "#d64550" }}>{error}</span>}
        <button type="button" className="btn primary small" onClick={save} disabled={saving}>
          Enregistrer
        </button>
      </div>
    </div>
  );
}
