// Comparatif 4 modèles — Philippe. Usage : npx tsx _run_comparison.mts <modelId> <outDir>
// Un run = nouvelle campagne/partie/2 joueurs dédiée, ~20 tours scénarisés identiques à
// scripts/simulate-session.mts (mêmes textes, pour comparer à contexte narratif égal), tool-calls
// attendus annotés sur les tours clés (dégâts ~#6, objet ~#11, advance_phase ~#12).
import { prisma } from "@superdiscogm/db";
import { rollDice } from "@superdiscogm/llm";
import { persistPlayerMessage, runMjTurn } from "../apps/web/src/server/turnEngine";
import fs from "node:fs";
import path from "node:path";

const modelId = process.argv[2];
const outDir = process.argv[3];
if (!modelId || !outDir) throw new Error("Usage: _run_comparison.mts <modelId> <outDir>");

await prisma.globalSettings.update({ where: { id: 1 }, data: { activeProvider: "openrouter", activeModel: modelId } });
console.log(`GlobalSettings -> openrouter/${modelId}`);

const scenario = await prisma.scenario.findUniqueOrThrow({
  where: { id: "cmsu1s0cv0000i0cnv9babv4g" },
  include: { phases: { orderBy: { order: "asc" } } },
});

const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
const campaign = await prisma.campaign.create({ data: { name: `Comparatif ${modelId} — ${scenario.title}`, createdById: admin.id } });
await prisma.campaignScenario.create({ data: { campaignId: campaign.id, scenarioId: scenario.id, order: 1 } });

const playerDefs = [
  { name: "Elyon Vasterel", race: "Elfe", className: "Rôdeur", hpMax: 24 },
  { name: "Kara Sombreval", race: "Humaine", className: "Voleuse", hpMax: 18 },
];
const testUsers: { userId: string; sheetId: string; name: string }[] = [];
for (const p of playerDefs) {
  const user = await prisma.user.create({
    data: {
      email: `cmp-${modelId.replace(/[^a-z0-9]/gi, "")}-${Date.now()}-${p.name.replace(/\s/g, "")}@test.local`,
      name: p.name,
      passwordHash: "x",
      role: "USER",
      avatarColor: "#5b8dee",
    },
  });
  const sheet = await prisma.characterSheet.create({
    data: {
      userId: user.id,
      campaignId: campaign.id,
      name: p.name,
      race: p.race,
      className: p.className,
      hp: p.hpMax,
      hpMax: p.hpMax,
      stats: { DEX: 3, CON: 1, SAG: 2 },
      inventory: [{ name: "Arc long", quantity: 1 }, { name: "Torche", quantity: 3 }],
    },
  });
  testUsers.push({ userId: user.id, sheetId: sheet.id, name: p.name });
}

const party = await prisma.party.create({ data: { campaignId: campaign.id, scenarioId: scenario.id, currentPhaseId: scenario.phases[0].id } });
for (const u of testUsers) await prisma.partyParticipant.create({ data: { partyId: party.id, userId: u.userId, role: "JOUEUR" } });

const mockIo = { to: () => ({ emit: () => {} }) } as unknown as import("socket.io").Server;

interface TurnLog {
  index: number;
  authorName: string;
  content: string;
  expected: string | null;
}
const turnLog: TurnLog[] = [];
let idx = 0;

async function playerTurn(userId: string, name: string, content: string, expected: string | null = null) {
  idx++;
  turnLog.push({ index: idx, authorName: name, content, expected });
  const msg = await persistPlayerMessage({ partyId: party.id, authorUserId: userId, content });
  const t0 = Date.now();
  await runMjTurn(mockIo, party.id, msg.id, []);
  console.log(`  tour ${idx} (${Date.now() - t0}ms)`);
}

async function forcedRoll(userId: string, name: string, formula: string, label: string) {
  const roll = rollDice(formula);
  await prisma.diceRoll.create({
    data: { partyId: party.id, rolledByUserId: userId, formula: roll.formula, result: roll as unknown as object, requestedByMj: false },
  });
  const modifierText = roll.modifier ? (roll.modifier > 0 ? ` +${roll.modifier}` : ` ${roll.modifier}`) : "";
  const content = `${label} 🎲 ${roll.formula} → [${roll.rolls.join(", ")}]${modifierText} = ${roll.total}`;
  await playerTurn(userId, name, content, null);
}

const [p1, p2] = testUsers;
const exitHint = scenario.phases[0].exitConditions ?? "";
const startTime = Date.now();

await playerTurn(p1.userId, p1.name, `Je m'avance prudemment pour aider à déblayer l'entrée, pioche en main.`);
await playerTurn(p2.userId, p2.name, `Je reste en retrait et surveille les alentours pendant que les autres creusent.`);
await forcedRoll(p1.userId, p1.name, "1d20+2", `Je sens que le sol est instable, je fais attention où je mets les pieds (jet de Vigilance).`);
await playerTurn(p1.userId, p1.name, `L'étançon vient de céder dans un bruit sinistre ! Je tente de m'écarter d'un bond pour éviter les débris (jet de Réflexes).`);
await playerTurn(p2.userId, p2.name, `Je crie pour prévenir les autres du danger et recule vivement vers la sortie.`);
await playerTurn(p1.userId, p1.name, `Les débris m'ont touché de plein fouet, je n'ai pas pu les éviter à temps, je saigne d'une entaille au bras.`, "apply_damage");
await playerTurn(p2.userId, p2.name, `Je me précipite vers Elyon pour voir l'étendue de ses blessures et l'aider à se relever.`);
await playerTurn(p1.userId, p1.name, `Malgré la douleur, je me relève et j'inspecte les décombres à la recherche d'un passage.`);
await playerTurn(p2.userId, p2.name, `J'examine les parois pour voir si la structure est stable ou si on risque un nouvel effondrement.`);
await playerTurn(p1.userId, p1.name, `La poussière retombe. L'accès à la zone est-il dégagé maintenant qu'on a évité l'effondrement ?`);
await playerTurn(p2.userId, p2.name, `Je ramasse une torche pour éclairer le passage qui semble s'ouvrir devant nous.`, "add_item");
await playerTurn(
  p1.userId,
  p1.name,
  `${exitHint ? `D'après ce qu'on peut voir, les conditions suivantes semblent réunies : ${exitHint}. ` : ""}On avance résolument vers la suite, l'entrée est maintenant dégagée derrière nous.`,
  "advance_phase"
);
await playerTurn(p2.userId, p2.name, `Je suis Elyon vers la zone suivante, prête à affronter ce qui nous attend.`);
await playerTurn(p1.userId, p1.name, `On progresse prudemment dans le nouveau passage qui s'ouvre devant nous.`);
await forcedRoll(p2.userId, p2.name, "1d20+3", `Je scrute l'obscurité devant nous à la recherche de danger (jet de Perception).`);
await playerTurn(p2.userId, p2.name, `Je décris ce que je perçois à Elyon à voix basse.`);
await playerTurn(p1.userId, p1.name, `On continue notre exploration en restant groupés et attentifs.`);
await playerTurn(p2.userId, p2.name, `Je vérifie l'état de mon équipement avant de poursuivre plus profondément.`);
await playerTurn(p1.userId, p1.name, `Où en sommes-nous exactement de notre progression dans le donjon ?`);
await playerTurn(p2.userId, p2.name, `On fait une courte pause pour reprendre son souffle avant de continuer.`);

const elapsedMs = Date.now() - startTime;

// Résultats
const messages = await prisma.message.findMany({ where: { partyId: party.id }, orderBy: { createdAt: "asc" } });
const logs = await prisma.characterSheetLog.findMany({ where: { characterSheetId: { in: testUsers.map((u) => u.sheetId) } } });
const finalParty = await prisma.party.findUniqueOrThrow({ where: { id: party.id }, include: { currentPhase: true } });
const usage = await prisma.usageLog.aggregate({
  where: { provider: "openrouter", model: modelId, createdAt: { gte: new Date(startTime) } },
  _sum: { inputTokens: true, outputTokens: true, costUsd: true },
  _count: true,
});

const toolNames = new Set(logs.map((l) => l.toolName));
const advanced = finalParty.currentPhaseId !== scenario.phases[0].id;
const expectedTools = ["apply_damage", "add_item"];
const gotExpected = expectedTools.filter((t) => toolNames.has(t));

const result = {
  modelId,
  scenarioTitle: scenario.title,
  startPhase: scenario.phases[0].title,
  finalPhase: finalParty.currentPhase?.title ?? null,
  advancedPhase: advanced,
  elapsedMs,
  messageCount: messages.length,
  toolCalls: logs.map((l) => ({ toolName: l.toolName, args: l.argsJson })),
  expectedTools,
  gotExpectedTools: gotExpected,
  toolCallScore: `${gotExpected.length + (advanced ? 1 : 0)}/${expectedTools.length + 1}`,
  usage: {
    calls: usage._count,
    inputTokens: usage._sum.inputTokens ?? 0,
    outputTokens: usage._sum.outputTokens ?? 0,
    costUsd: usage._sum.costUsd,
  },
};

const dir = path.join("test-campagne", outDir);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "data.json"), JSON.stringify({ result, turnLog, messages: messages.map((m) => ({ authorType: m.authorType, content: m.content, createdAt: m.createdAt })) }, null, 2));

console.log("\n=== RÉSULTAT ===");
console.log(JSON.stringify(result, null, 2));

await prisma.$disconnect();
