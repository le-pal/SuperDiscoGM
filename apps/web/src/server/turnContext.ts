import { prisma } from "@superdiscogm/db";
import { resolvePersona } from "./persona";

// Assemblage du contexte de tour [Q19] : chaque tour envoyé au modèle est reconstruit à partir
// de 5 blocs maintenus séparément (doc/scenario/spec.md "Gestion du contexte"). Aucun tokenizer
// dédié en V1 (cf audit librairies) : approximation grossière 1 token ≈ 4 caractères, budget par
// caractères plutôt que par tokens réels — un compte exact par fournisseur viendra avec le suivi
// de budget (étape 48).
const CONTEXT_CHAR_BUDGET = Number(process.env.CONTEXT_CHAR_BUDGET ?? 24000);

export interface TurnContextMessage {
  authorType: "PLAYER" | "MJ" | "SYSTEM";
  authorName: string | null;
  content: string;
}

export interface TurnContextBlocks {
  scenarioDigest: string;
  partySummary: string;
  relevantEntities: string;
  systemPrompt: string;
  recentMessages: TurnContextMessage[];
}

export async function assembleTurnContext(partyId: string): Promise<TurnContextBlocks> {
  const party = await prisma.party.findUniqueOrThrow({
    where: { id: partyId },
    include: { currentPhase: true },
  });

  const persona = await resolvePersona(party.campaignId, party.scenarioId);
  const settings = await prisma.globalSettings.findUniqueOrThrow({ where: { id: 1 } });
  // Composition par-dessus le prompt global, jamais à sa place [Q24].
  const systemPrompt = persona
    ? `${settings.systemPrompt}\n\n${persona.systemPromptFragment}`
    : settings.systemPrompt;

  // Bloc 1 — scénario digéré : toutes les phases pour la continuité narrative, métadonnées
  // structurées détaillées uniquement pour la phase active [Q16].
  const phases = await prisma.phase.findMany({
    where: { scenarioId: party.scenarioId },
    orderBy: { order: "asc" },
  });
  const scenarioDigest =
    phases
      .map((p) => {
        const isCurrent = p.id === party.currentPhaseId;
        const header = `### ${p.title}${isCurrent ? " (phase actuelle)" : ""}\n${p.summary}`;
        if (!isCurrent) return header;
        return (
          header +
          `\nPNJ présents : ${p.npcTags.join(", ") || "aucun"}` +
          `\nConditions de sortie : ${p.exitConditions ?? "non précisées"}` +
          `\nSecrets : ${p.secrets ?? "aucun"}`
        );
      })
      .join("\n\n") || "(scénario non encore digéré)";

  // Bloc 2 — résumé de la partie : hiérarchie à 3 niveaux, du plus large au plus précis [Q22].
  const [campaignSummary, arcSummary, sessionSummary] = await Promise.all([
    prisma.summary.findFirst({ where: { level: "CAMPAIGN", campaignId: party.campaignId } }),
    prisma.summary.findFirst({
      where: { level: "ARC", campaignId: party.campaignId, scenarioId: party.scenarioId },
    }),
    prisma.summary.findFirst({ where: { level: "SESSION", campaignId: party.campaignId, partyId } }),
  ]);
  const partySummary =
    [
      campaignSummary && `Résumé de campagne :\n${campaignSummary.content}`,
      arcSummary && `Résumé du scénario en cours :\n${arcSummary.content}`,
      sessionSummary && `Résumé de la session en cours :\n${sessionSummary.content}`,
    ]
      .filter(Boolean)
      .join("\n\n") || "(aucun résumé disponible pour l'instant)";

  // Bloc 3 — fiches entités pertinentes à la scène active seulement, jamais tout l'index [Q44].
  const activeNpcTags = party.currentPhase?.npcTags ?? [];
  const relevantMemories = activeNpcTags.length
    ? await prisma.entityMemory.findMany({
        where: { campaignId: party.campaignId, name: { in: activeNpcTags } },
      })
    : [];
  const relevantEntities = relevantMemories.length
    ? relevantMemories.map((e) => `- (${e.type}) ${e.name} : ${e.summary}`).join("\n")
    : "(aucune entité pertinente indexée pour la scène actuelle)";

  // Bloc 5 — fenêtre glissante des derniers échanges bruts : seul bloc tronqué en cas de
  // dépassement de budget, les 4 autres restent prioritaires et ne sont jamais coupés [Q19].
  const candidates = await prisma.message.findMany({
    where: { partyId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { authorUser: { select: { name: true } } },
  });

  const fixedBlocksSize =
    scenarioDigest.length + partySummary.length + relevantEntities.length + systemPrompt.length;
  const remainingBudget = Math.max(0, CONTEXT_CHAR_BUDGET - fixedBlocksSize);

  const recentMessages: TurnContextMessage[] = [];
  let used = 0;
  for (const m of candidates) {
    // candidates est du plus récent au plus ancien ; on garde toujours au moins le dernier
    // message même s'il dépasse seul le budget restant (mieux vaut un contexte serré qu'aucun).
    if (used + m.content.length > remainingBudget && recentMessages.length > 0) break;
    recentMessages.unshift({
      authorType: m.authorType,
      authorName: m.authorUser?.name ?? null,
      content: m.content,
    });
    used += m.content.length;
  }

  return { scenarioDigest, partySummary, relevantEntities, systemPrompt, recentMessages };
}
