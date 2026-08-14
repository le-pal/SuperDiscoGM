import { prisma } from "@superdiscogm/db";

/**
 * Résolution par spécificité [Q06] : scénario > campagne > persona globale par défaut.
 * Composée par-dessus (jamais à la place de) le prompt système global [Q24] — c'est à
 * l'appelant (assemblage de contexte, étape 30) de concaténer GlobalSettings.systemPrompt +
 * le fragment de persona résolu ici, jamais l'un remplaçant l'autre.
 */
export async function resolvePersona(campaignId?: string | null, scenarioId?: string | null) {
  if (scenarioId) {
    const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId }, include: { persona: true } });
    if (scenario?.persona) return scenario.persona;
  }

  if (campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { persona: true } });
    if (campaign?.persona) return campaign.persona;
  }

  return null; // pas de persona par défaut imposée — le prompt système global suffit alors seul
}
