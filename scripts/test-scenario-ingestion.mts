// Outil de test manuel du pipeline d'ingestion de scénario [Q14] contre un vrai LLM (typiquement
// Ollama en local, cf DATABASE_URL/REDIS_URL requis). Crée un Scenario à partir d'un fichier
// markdown, enqueue le job réel (apps/worker doit tourner), affiche les Phase générées pour
// inspection qualitative. Utilisé pour trouver/valider le fix num_ctx (packages/llm/src/index.ts).
//
// Usage : DATABASE_URL=... REDIS_URL=... npx tsx scripts/test-scenario-ingestion.mts <fichier.md>
import { readFile } from "node:fs/promises";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@superdiscogm/db";
import { QUEUE_NAMES } from "@superdiscogm/jobs";

const fileArg = process.argv[2];
const content = await readFile(fileArg, "utf-8");
const title = fileArg.split(/[\\/]/).pop()!.replace(/\.md$/, "");

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
const queue = new Queue(QUEUE_NAMES.SCENARIO_INGESTION, { connection });

const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });

const scenario = await prisma.scenario.create({
  data: { title, rawContent: content, createdById: admin.id },
});
console.log(`Scenario créé : ${scenario.id} (${title})`);

await queue.add("analyze", { scenarioId: scenario.id });
console.log("Job enqueued. Attente du traitement...");

const start = Date.now();
while (Date.now() - start < 8 * 60 * 1000) {
  await new Promise((r) => setTimeout(r, 3000));
  const s = await prisma.scenario.findUniqueOrThrow({ where: { id: scenario.id } });
  process.stdout.write(`[${Math.round((Date.now() - start) / 1000)}s] status=${s.status}\r\n`);
  if (s.status === "READY") {
    console.log("READY.");
    break;
  }
}

const phases = await prisma.phase.findMany({ where: { scenarioId: scenario.id }, orderBy: { order: "asc" } });
console.log(`\n${phases.length} phases générées :\n`);
for (const p of phases) {
  console.log(`--- #${p.order + 1} ${p.title} ---`);
  console.log(`Résumé: ${p.summary}`);
  console.log(`Lieu: ${p.locationTag ?? "(vide)"}`);
  console.log(`PNJ: ${p.npcTags.join(", ") || "(vide)"}`);
  console.log(`Sortie: ${p.exitConditions ?? "(vide)"}`);
  console.log(`Secrets: ${p.secrets ?? "(vide)"}`);
  console.log();
}

console.log(`SCENARIO_ID=${scenario.id}`);

await queue.close();
await connection.quit();
await prisma.$disconnect();
