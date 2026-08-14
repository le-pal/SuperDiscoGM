import { Queue } from "bullmq";
import IORedis from "ioredis";
import { QUEUE_NAMES } from "@superdiscogm/jobs";

// Producteur BullMQ côté web, symétrique du Worker côté apps/worker — même connexion Redis,
// mêmes noms de queue (packages/jobs, source unique de vérité) pour éviter toute désynchronisation.
// lazyConnect : ne se connecte qu'au premier usage réel, pas à l'import du module — sinon
// `next build` tente une connexion Redis (absente en build stage Docker) et pollue les logs.
const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

export const scenarioIngestionQueue = new Queue(QUEUE_NAMES.SCENARIO_INGESTION, { connection });
export const entityMemoryQueue = new Queue(QUEUE_NAMES.ENTITY_MEMORY_EXTRACTION, { connection });
export const summaryConsolidationQueue = new Queue(QUEUE_NAMES.SUMMARY_CONSOLIDATION, { connection });
