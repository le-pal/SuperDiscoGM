import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOllama } from "ollama-ai-provider-v2";
import type { LanguageModel } from "ai";
import type { ProviderOptions } from "@ai-sdk/provider-utils";
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

// Ollama plafonne la fenêtre de contexte à 4096 tokens par défaut (num_ctx), quelle que soit la
// fenêtre max annoncée par le modèle (ex: qwen3.5:9b annonce 262144) — DÉCOUVERT en testant
// l'ingestion de scénario en conditions réelles (session du 2026-08-15) : le JSON structuré était
// tronqué en plein milieu (finishReason "length") dès qu'un scénario dépassait quelques milliers
// de tokens en entrée, avant même de laisser de la place pour la sortie. Sans ce réglage, TOUT
// appel LLM via Ollama (ingestion, tour de jeu, mémoire, résumés) était silencieusement susceptible
// de tronquer sa réponse. 32768 = compromis pragmatique pour couvrir un scénario long typique
// (testé jusqu'à ~40k tokens en entrée) sans exploser le temps de calcul sur un poste de dev sans
// GPU dédié — un scénario encore plus long réintroduira le même symptôme, à surveiller.
const OLLAMA_NUM_CTX = 32768;

export function buildProviderOptions(provider: string): ProviderOptions | undefined {
  if (provider !== "ollama") return undefined;
  return { ollama: { options: { num_ctx: OLLAMA_NUM_CTX } } };
}

export async function getConfiguredModel(): Promise<LanguageModel> {
  const settings = await prisma.globalSettings.findUniqueOrThrow({ where: { id: 1 } });
  return resolveModel(settings.activeProvider, settings.activeModel);
}

// Variante utilisée par les appelants qui journalisent l'usage (étape 48) — provider/model en
// texte sont nécessaires pour recordUsage() (estimation de coût par la table de tarifs) et ne
// sont pas récupérables depuis un LanguageModel déjà résolu.
export async function getConfiguredModelInfo(): Promise<{ model: LanguageModel; provider: string; modelName: string }> {
  const settings = await prisma.globalSettings.findUniqueOrThrow({ where: { id: 1 } });
  return {
    model: resolveModel(settings.activeProvider, settings.activeModel),
    provider: settings.activeProvider,
    modelName: settings.activeModel,
  };
}

export { gameTools, buildGameTools, rollDiceTool, rollDice, createLookupEntityHistoryTool, createAdvancePhaseTool } from "./tools";
export type { DiceRollResult } from "./tools";
export { recordUsage } from "./usage";
export type { UsageSource } from "./usage";
export { estimateCostUsd } from "./pricing";
