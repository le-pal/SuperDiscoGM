import { tool } from "ai";
import { z } from "zod";

// Preuve de concept du pattern "tool-call déterministe" [Q32] : le résultat vient d'un RNG
// serveur, jamais généré/inventé par le modèle. Les futurs outils (moteur de règles [Q32b],
// mise à jour de fiche perso [Q31b]) suivent la même forme : schéma zod strict + execute()
// pur côté serveur, aucune place laissée à l'improvisation du LLM sur le résultat.
const formulaPattern = /^(\d+)d(\d+)([+-]\d+)?$/;

export const rollDiceTool = tool({
  description:
    "Lance des dés selon une formule type JDR (ex: 1d20+3, 2d6). Le résultat est calculé par un générateur aléatoire côté serveur — jamais à inventer soi-même.",
  inputSchema: z.object({
    formula: z
      .string()
      .regex(formulaPattern, "Format attendu : NdM ou NdM+K (ex: 1d20, 2d6+1)"),
  }),
  execute: async ({ formula }) => {
    const match = formula.match(formulaPattern);
    if (!match) throw new Error(`Formule de dé invalide : ${formula}`);

    const [, countStr, facesStr, modifierStr] = match;
    const count = Number(countStr);
    const faces = Number(facesStr);
    const modifier = modifierStr ? Number(modifierStr) : 0;

    const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * faces));
    const total = rolls.reduce((sum, r) => sum + r, 0) + modifier;

    return { formula, rolls, modifier, total };
  },
});
