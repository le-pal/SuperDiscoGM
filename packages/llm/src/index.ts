import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOllama } from "ollama-ai-provider-v2";
import type { LanguageModel } from "ai";
import { prisma } from "@superdiscogm/db";

// Abstraction multi-fournisseurs [Q37] : sélection du modèle actif = droit Admin, lu depuis
// GlobalSettings plutôt que codé en dur — un seul endroit à changer pour basculer de
// fournisseur (ex: Ollama en dev -> Anthropic en prod, séquence actée avec Philippe).
export type LLMProvider = "anthropic" | "openai" | "ollama";

export function resolveModel(provider: string, model: string): LanguageModel {
  switch (provider as LLMProvider) {
    case "anthropic":
      return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(model);
    case "openai":
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(model);
    case "ollama":
      // Endpoint natif Ollama (/api), pas le mode OpenAI-compatible (/v1) — cf audit [Q37].
      return createOllama({ baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/api" })(model);
    default:
      throw new Error(`Fournisseur LLM inconnu : "${provider}". Voir doc/technique/spec.md [Q37].`);
  }
}

export async function getConfiguredModel(): Promise<LanguageModel> {
  const settings = await prisma.globalSettings.findUniqueOrThrow({ where: { id: 1 } });
  return resolveModel(settings.activeProvider, settings.activeModel);
}

export { gameTools, buildGameTools, rollDiceTool, createLookupEntityHistoryTool, createAdvancePhaseTool } from "./tools";
