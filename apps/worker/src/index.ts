import { Worker } from "bullmq";
import { QUEUE_NAMES } from "@superdiscogm/jobs";
import { connection } from "./redis";
import { processScenarioIngestion } from "./workers/ingestion";
import { processEntityMemoryExtraction } from "./workers/entityMemory";
import { processSummaryConsolidation } from "./workers/summaries";

const workers = [
  new Worker(QUEUE_NAMES.SCENARIO_INGESTION, processScenarioIngestion, { connection }),
  new Worker(QUEUE_NAMES.ENTITY_MEMORY_EXTRACTION, processEntityMemoryExtraction, { connection }),
  new Worker(QUEUE_NAMES.SUMMARY_CONSOLIDATION, processSummaryConsolidation, { connection }),
];

for (const worker of workers) {
  worker.on("completed", (job) => {
    console.log(`[${worker.name}] job ${job.id} terminé`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[${worker.name}] job ${job?.id} échoué:`, err);
  });
}

console.log(`> Worker SuperDiscoGM prêt — écoute : ${workers.map((w) => w.name).join(", ")}`);

async function shutdown() {
  console.log("> Arrêt du worker...");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
