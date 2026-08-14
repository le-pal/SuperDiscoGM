import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@superdiscogm/db";

// Détection de transition de phase [Q17] : automatique par le MJ-IA, qui compare la
// conversation en cours aux conditions de sortie de la phase active — jamais une décision
// prise en texte libre, le déplacement du curseur de partie passe par ce tool-call déterministe
// (même discipline que le moteur de règles [Q32b]). Scopé à une partie précise (comme
// lookup_entity_history est scopé campagne) puisque partyId ne peut pas venir du modèle.
//
// L'annonce visible en chat de la transition (message SYSTEM) reste du ressort du moteur de
// tour (étape 35), qui a accès à la room Socket.IO — ce module ne fait que la mutation d'état.
export function createAdvancePhaseTool(partyId: string) {
  return tool({
    description:
      "Fait avancer la partie vers la phase suivante du scénario, uniquement lorsque les conditions de sortie de la phase actuelle sont manifestement remplies par la conversation. Ne pas appeler par anticipation.",
    inputSchema: z.object({
      reason: z.string().describe("Courte justification : quelles conditions de sortie ont été remplies."),
    }),
    execute: async ({ reason }) => {
      const party = await prisma.party.findUniqueOrThrow({ where: { id: partyId } });
      const phases = await prisma.phase.findMany({
        where: { scenarioId: party.scenarioId },
        orderBy: { order: "asc" },
      });

      const currentIndex = phases.findIndex((p) => p.id === party.currentPhaseId);
      const nextPhase = phases[currentIndex + 1];

      if (!nextPhase) {
        return { advanced: false, message: "Aucune phase suivante : dernière phase du scénario déjà atteinte." };
      }

      await prisma.party.update({ where: { id: partyId }, data: { currentPhaseId: nextPhase.id } });

      return {
        advanced: true,
        previousPhase: currentIndex >= 0 ? { id: phases[currentIndex].id, title: phases[currentIndex].title } : null,
        newPhase: { id: nextPhase.id, title: nextPhase.title },
        reason,
      };
    },
  });
}
