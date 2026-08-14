// Table de tarifs approximative — étape 48, suivi de budget/coût [Q03]. À vérifier
// périodiquement : les tarifs des fournisseurs changent sans préavis et rien de comparable à
// `npm view` n'existe pour les auditer automatiquement. Ollama = 0 (auto-hébergé, aucun appel
// facturé). Un modèle absent de cette table renvoie `null` — mieux vaut un coût manquant qu'un
// chiffre inventé affiché comme fiable à l'Admin.
const PRICING_USD_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "anthropic/claude-sonnet-5": { input: 3, output: 15 },
  "anthropic/claude-opus-5": { input: 15, output: 75 },
  "anthropic/claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
};

export function estimateCostUsd(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): number | null {
  if (provider === "ollama") return 0;

  const pricing = PRICING_USD_PER_MILLION_TOKENS[`${provider}/${model}`];
  if (!pricing) return null;

  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}
