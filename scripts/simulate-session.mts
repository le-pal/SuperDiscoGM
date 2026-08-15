// Simulation d'une partie jouée de bout en bout, en appelant directement le moteur de tour
// (turnEngine.ts) sans passer par Socket.IO/HTTP — un mock minimal de `io` suffit puisque
// runMjTurn n'a besoin que de `io.to(room).emit(...)`. Sert à vérifier que persistance, appels
// LLM réels, tool-calls (dés/fiche/phase) et déclenchement mémoire/résumés fonctionnent
// ensemble sur un scénario déjà digéré (cf scripts/test-scenario-ingestion.mts).
//
// Usage :
//   Nouvelle campagne :  npx tsx scripts/simulate-session.mts <scenarioId>
//   Scénario suivant, même campagne (teste Q23/Q45/Q47 — mémoire d'entité et fiches qui
//   traversent les scénarios) :
//                        npx tsx scripts/simulate-session.mts <scenarioId> <campaignId> <userId1,userId2,...>
//   (campaignId/userIds affichés en fin d'exécution du premier run, à copier-coller)
import { prisma } from "@superdiscogm/db";
import { rollDice } from "@superdiscogm/llm";
import { persistPlayerMessage, runMjTurn } from "../apps/web/src/server/turnEngine";

const scenarioId = process.argv[2];
const existingCampaignId = process.argv[3];
const existingUserIds = process.argv[4]?.split(",");
if (!scenarioId) {
  console.error("Usage: simulate-session.mts <scenarioId> [campaignId] [userId1,userId2]");
  process.exit(1);
}

const mockIo = {
  to: (room: string) => ({
    emit: (event: string, payload: unknown) => {
      if (event === "chat:stream") return; // trop verbeux, on affiche seulement le message final
      const text = JSON.stringify(payload);
      console.log(`[socket:${room}] ${event} ${text.slice(0, 400)}`);
    },
  }),
} as unknown as import("socket.io").Server;

const scenario = await prisma.scenario.findUniqueOrThrow({
  where: { id: scenarioId },
  include: { phases: { orderBy: { order: "asc" } } },
});
if (scenario.status !== "READY" || scenario.phases.length === 0) {
  throw new Error(`Scénario ${scenarioId} pas prêt (status=${scenario.status}, phases=${scenario.phases.length})`);
}

let campaignId: string;
let testUsers: { userId: string; sheetId: string; name: string }[] = [];

if (existingCampaignId && existingUserIds) {
  // Mode "scénario suivant" — même campagne [Q10], mêmes joueurs, fiches réutilisées telles
  // quelles (liées à la campagne, pas au scénario [Q47]).
  campaignId = existingCampaignId;
  const nextOrder = (await prisma.campaignScenario.count({ where: { campaignId } })) + 1;
  await prisma.campaignScenario.create({ data: { campaignId, scenarioId, order: nextOrder } });

  for (const userId of existingUserIds) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const sheet = await prisma.characterSheet.findUniqueOrThrow({
      where: { userId_campaignId: { userId, campaignId } },
    });
    testUsers.push({ userId, sheetId: sheet.id, name: user.name });
    console.log(`Joueur réutilisé : ${user.name} (PV ${sheet.hp}/${sheet.hpMax}, niveau ${sheet.level})`);
  }
} else {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  const campaign = await prisma.campaign.create({
    data: { name: `Simulation — ${scenario.title}`, createdById: admin.id },
  });
  campaignId = campaign.id;
  await prisma.campaignScenario.create({ data: { campaignId, scenarioId, order: 1 } });

  const players = [
    { name: "Elyon Vasterel", race: "Elfe", className: "Rôdeur", hpMax: 24 },
    { name: "Kara Sombreval", race: "Humaine", className: "Voleuse", hpMax: 18 },
  ];
  for (const p of players) {
    const user = await prisma.user.create({
      data: {
        email: `sim-${Date.now()}-${p.name.replace(/\s/g, "").toLowerCase()}@test.local`,
        name: p.name,
        passwordHash: "not-a-real-hash",
        role: "USER",
        avatarColor: "#5b8dee",
      },
    });
    const sheet = await prisma.characterSheet.create({
      data: {
        userId: user.id,
        campaignId,
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
    console.log(`Joueur créé : ${p.name} (user=${user.id}, sheet=${sheet.id})`);
  }
}

const party = await prisma.party.create({
  data: { campaignId, scenarioId, currentPhaseId: scenario.phases[0].id },
});
for (const u of testUsers) {
  await prisma.partyParticipant.create({ data: { partyId: party.id, userId: u.userId, role: "JOUEUR" } });
}
console.log(`Campagne ${campaignId}, Partie ${party.id}, phase de départ "${scenario.phases[0].title}"`);

async function playerTurn(userId: string, content: string) {
  console.log(`\n=== Tour : "${content}" ===`);
  const msg = await persistPlayerMessage({ partyId: party.id, authorUserId: userId, content });
  await runMjTurn(mockIo, party.id, msg.id, []);
}

// Jet de dé garanti (même mécanisme que /roll côté socket.ts, étape 37) — indépendant de la
// discrétion du MJ-IA, pour vérifier de façon déterministe que rollDice()/DiceRoll fonctionnent.
async function forcedRoll(userId: string, formula: string, label: string) {
  const roll = rollDice(formula);
  await prisma.diceRoll.create({
    data: { partyId: party.id, rolledByUserId: userId, formula: roll.formula, result: roll as unknown as object, requestedByMj: false },
  });
  const modifierText = roll.modifier ? (roll.modifier > 0 ? ` +${roll.modifier}` : ` ${roll.modifier}`) : "";
  const content = `${label} 🎲 ${roll.formula} → [${roll.rolls.join(", ")}]${modifierText} = ${roll.total}`;
  console.log(`\n=== Jet forcé : "${content}" ===`);
  const msg = await persistPlayerMessage({ partyId: party.id, authorUserId: userId, content });
  await runMjTurn(mockIo, party.id, msg.id, []);
}

const [p1, p2] = testUsers;
const exitHint = scenario.phases[0].exitConditions ?? "";

// ~20 échanges, intrigue qui avance réellement sur la scène active plutôt que des banalités
// répétées : approche -> incident mécanique -> jet forcé -> interaction PNJ -> dégâts attendus
// (tool-call MJ) -> relance explicite vers la sortie de scène (advance_phase).
await playerTurn(p1.userId, `Je m'avance prudemment pour aider à déblayer l'entrée, pioche en main.`);
await playerTurn(p2.userId, `Je reste en retrait et surveille les alentours pendant que les autres creusent.`);
await forcedRoll(p1.userId, "1d20+2", `Je sens que le sol est instable, je fais attention où je mets les pieds (jet de Vigilance).`);
await playerTurn(p1.userId, `L'étançon vient de céder dans un bruit sinistre ! Je tente de m'écarter d'un bond pour éviter les débris (jet de Réflexes).`);
await playerTurn(p2.userId, `Je crie pour prévenir les autres du danger et recule vivement vers la sortie.`);
await playerTurn(p1.userId, `Les débris m'ont touché de plein fouet, je n'ai pas pu les éviter à temps, je saigne d'une entaille au bras.`);
await playerTurn(p2.userId, `Je me précipite vers Elyon pour voir l'étendue de ses blessures et l'aider à se relever.`);
await playerTurn(p1.userId, `Malgré la douleur, je me relève et j'inspecte les décombres à la recherche d'un passage.`);
await playerTurn(p2.userId, `J'examine les parois pour voir si la structure est stable ou si on risque un nouvel effondrement.`);
await playerTurn(p1.userId, `La poussière retombe. L'accès à la zone est-il dégagé maintenant qu'on a évité l'effondrement ?`);
await playerTurn(p2.userId, `Je ramasse une torche pour éclairer le passage qui semble s'ouvrir devant nous.`);
await playerTurn(
  p1.userId,
  `${exitHint ? `D'après ce qu'on peut voir, les conditions suivantes semblent réunies : ${exitHint}. ` : ""}On avance résolument vers la suite, l'entrée est maintenant dégagée derrière nous.`
);
await playerTurn(p2.userId, `Je suis Elyon vers la zone suivante, prête à affronter ce qui nous attend.`);
await playerTurn(p1.userId, `On progresse prudemment dans le nouveau passage qui s'ouvre devant nous.`);
await forcedRoll(p2.userId, "1d20+3", `Je scrute l'obscurité devant nous à la recherche de danger (jet de Perception).`);
await playerTurn(p2.userId, `Je décris ce que je perçois à Elyon à voix basse.`);
await playerTurn(p1.userId, `On continue notre exploration en restant groupés et attentifs.`);
await playerTurn(p2.userId, `Je vérifie l'état de mon équipement avant de poursuivre plus profondément.`);
await playerTurn(p1.userId, `Où en sommes-nous exactement de notre progression dans le donjon ?`);
await playerTurn(p2.userId, `On fait une courte pause pour reprendre son souffle avant de continuer.`);

const finalState = await prisma.party.findUniqueOrThrow({
  where: { id: party.id },
  include: { currentPhase: true },
});
console.log(`\nPhase finale : ${finalState.currentPhase?.title ?? "(aucune)"} (départ: "${scenario.phases[0].title}")`);

const messages = await prisma.message.findMany({ where: { partyId: party.id }, orderBy: { createdAt: "asc" } });
console.log(`${messages.length} messages persistés (${messages.filter((m) => m.authorType === "MJ").length} du MJ, ${messages.filter((m) => m.authorType === "SYSTEM").length} SYSTEM).`);

const logs = await prisma.characterSheetLog.findMany({ where: { characterSheetId: { in: testUsers.map((u) => u.sheetId) } } });
console.log(`${logs.length} entrées CharacterSheetLog (tool-calls fiche) :`);
for (const l of logs) console.log(`  - ${l.toolName}: ${JSON.stringify(l.argsJson)} -> ${JSON.stringify(l.resultJson)}`);

const rolls = await prisma.diceRoll.findMany({ where: { partyId: party.id } });
console.log(`${rolls.length} DiceRoll (dont ${rolls.filter((r) => r.requestedByMj).length} sollicités par le MJ).`);

const entities = await prisma.entityMemory.findMany({ where: { campaignId } });
console.log(`${entities.length} EntityMemory pour la campagne : ${entities.map((e) => `${e.name} (${e.type})`).join(", ") || "(aucune)"}`);

const summaries = await prisma.summary.findMany({ where: { campaignId } });
console.log(`${summaries.length} Summary pour la campagne : ${summaries.map((s) => s.level).join(", ") || "(aucun)"}`);

console.log(`\nPARTY_ID=${party.id}`);
console.log(`CAMPAIGN_ID=${campaignId}`);
console.log(`USER_IDS=${testUsers.map((u) => u.userId).join(",")}`);

await prisma.$disconnect();
