import { rollDiceTool } from "./dice";

// Registre central des outils déterministes exposés au MJ-IA. Ajouter ici le moteur de
// règles (CA/dégâts/sorts, [Q32b]) et la mise à jour de fiche perso ([Q31b]) quand ils
// existeront — même pattern que rollDiceTool, pas de redesign nécessaire.
export const gameTools = {
  roll_dice: rollDiceTool,
};

export { rollDiceTool };
