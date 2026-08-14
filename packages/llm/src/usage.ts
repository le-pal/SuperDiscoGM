import type { LanguageModelUsage } from "ai";
import { prisma } from "@superdiscogm/db";
import { estimateCostUsd } from "./pricing";

export type UsageSource = "turn_engine" | "entity_memory" | "summary_consolidation" | "scenario_ingestion";

// Écriture partagée entre apps/web (turnEngine.ts) et apps/worker (entityMemory.ts,
// summaries.ts) — un seul endroit pour la logique d'estimation de coût, jamais dupliquée par
// appelant. inputTokens/outputTokens undefined (certains fournisseurs ne les remontent pas
// systématiquement) sont journalisés comme 0 plutôt que de faire échouer l'appel LLM lui-même.
export async function recordUsage(params: {
  provider: string;
  model: string;
  usage: LanguageModelUsage;
  source: UsageSource;
}): Promise<void> {
  const inputTokens = params.usage.inputTokens ?? 0;
  const outputTokens = params.usage.outputTokens ?? 0;
  const costUsd = estimateCostUsd(params.provider, params.model, inputTokens, outputTokens);

  await prisma.usageLog.create({
    data: {
      provider: params.provider,
      model: params.model,
      inputTokens,
      outputTokens,
      costUsd,
      source: params.source,
    },
  });
}
