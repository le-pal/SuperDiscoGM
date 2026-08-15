import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOllama } from "ollama-ai-provider-v2";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import type { ProviderOptions } from "@ai-sdk/provider-utils";
import { prisma } from "@superdiscogm/db";

// Abstraction multi-fournisseurs [Q37] : sélection du modèle actif = droit Admin, lu depuis
// GlobalSettings plutôt que codé en dur — un seul endroit à changer pour basculer de
// fournisseur (ex: Ollama en dev -> Anthropic en prod, séquence actée avec Philippe).
// openrouter ajouté sur demande explicite de Philippe (accès à des modèles hors des 3
// fournisseurs déjà câblés, ex: DeepSeek) — testé en conditions réelles (session 2026-08-15).
export type LLMProvider = "anthropic" | "openai" | "ollama" | "openrouter";

export interface ProviderCredentialInput {
  apiKey?: string | null;
  baseUrl?: string | null;
}

// credential : configuré par l'Admin depuis l'UI (ProviderCredential en DB) — avant cet ajout,
// seule une variable d'env fixée au déploiement pouvait fournir une clé API, impossible à
// changer sans redéployer. Repli sur les variables d'env si aucun credential n'est enregistré,
// pour ne pas casser les déploiements existants qui les utilisent déjà.
export function resolveModel(provider: string, model: string, credential?: ProviderCredentialInput): LanguageModel {
  switch (provider as LLMProvider) {
    case "anthropic":
      return createAnthropic({ apiKey: credential?.apiKey ?? process.env.ANTHROPIC_API_KEY })(model);
    case "openai":
      return createOpenAI({
        apiKey: credential?.apiKey ?? process.env.OPENAI_API_KEY,
        baseURL: credential?.baseUrl ?? undefined,
      })(model);
    case "ollama":
      // Endpoint natif Ollama (/api), pas le mode OpenAI-compatible (/v1) — cf audit [Q37].
      return createOllama({
        baseURL: credential?.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/api",
      })(model);
    case "openrouter":
      return createOpenRouter({
        apiKey: credential?.apiKey ?? process.env.OPENROUTER_API_KEY,
        baseURL: credential?.baseUrl ?? undefined,
      }).chat(model);
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

async function loadCredential(provider: string): Promise<ProviderCredentialInput | undefined> {
  const credential = await prisma.providerCredential.findUnique({ where: { provider } });
  if (!credential) return undefined;
  return { apiKey: credential.apiKey, baseUrl: credential.baseUrl };
}

export async function getConfiguredModel(): Promise<LanguageModel> {
  const settings = await prisma.globalSettings.findUniqueOrThrow({ where: { id: 1 } });
  const credential = await loadCredential(settings.activeProvider);
  return resolveModel(settings.activeProvider, settings.activeModel, credential);
}

// Variante utilisée par les appelants qui journalisent l'usage (étape 48) — provider/model en
// texte sont nécessaires pour recordUsage() (estimation de coût par la table de tarifs) et ne
// sont pas récupérables depuis un LanguageModel déjà résolu.
export async function getConfiguredModelInfo(): Promise<{ model: LanguageModel; provider: string; modelName: string }> {
  const settings = await prisma.globalSettings.findUniqueOrThrow({ where: { id: 1 } });
  const credential = await loadCredential(settings.activeProvider);
  return {
    model: resolveModel(settings.activeProvider, settings.activeModel, credential),
    provider: settings.activeProvider,
    modelName: settings.activeModel,
  };
}

export { gameTools, buildGameTools, rollDiceTool, rollDice, createLookupEntityHistoryTool, createAdvancePhaseTool } from "./tools";
export type { DiceRollResult } from "./tools";
export { recordUsage } from "./usage";
export type { UsageSource } from "./usage";
export { estimateCostUsd } from "./pricing";
