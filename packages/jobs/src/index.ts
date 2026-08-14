// Contrats partagés entre le producteur (apps/web, qui enqueue) et le worker (apps/worker,
// qui consomme) — source unique de vérité pour les noms de queue et la forme des payloads.
// Les trois jobs correspondent exactement à ce qui est explicitement asynchrone dans la spec :
// doc/scenario/spec.md (§ Pipeline d'ingestion [Q14], § Mémoire indexée par entité [Q42],
// § Gestion du contexte [Q22]). Les réponses du MJ-IA en direct dans le chat NE PASSENT PAS
// par ces queues — elles restent synchrones/streamées depuis apps/web.

export const QUEUE_NAMES = {
  SCENARIO_INGESTION: "scenario-ingestion",
  ENTITY_MEMORY_EXTRACTION: "entity-memory-extraction",
  SUMMARY_CONSOLIDATION: "summary-consolidation",
} as const;

export interface ScenarioIngestionJob {
  scenarioId: string;
}

export interface EntityMemoryExtractionJob {
  partyId: string;
  campaignId: string;
  /** Plage de messages à analyser pour cette extraction (Q43 : granularité échange/scène). */
  fromMessageId: string;
  toMessageId: string;
}

export interface SummaryConsolidationJob {
  level: "SESSION" | "ARC" | "CAMPAIGN";
  campaignId: string;
  /** Requis si level = SESSION [Q22] */
  partyId?: string;
  /** Requis si level = ARC (un résumé d'arc par scénario de la campagne) [Q22] */
  scenarioId?: string;
}
