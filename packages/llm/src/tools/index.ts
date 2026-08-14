import { rollDiceTool, rollDice } from "./dice";
export type { DiceRollResult } from "./dice";
import {
  applyDamageTool,
  healTool,
  addItemTool,
  removeItemTool,
  addConditionTool,
  removeConditionTool,
  consumeSpellSlotTool,
  updateAcTool,
} from "./characterSheet";
import { createLookupEntityHistoryTool } from "./entityHistory";
import { createAdvancePhaseTool } from "./phaseTransition";

// Registre central des outils déterministes exposés au MJ-IA — même pattern pour tous
// (schéma zod strict + execute() pur côté serveur), aucune place laissée à l'improvisation du LLM.
export const gameTools = {
  roll_dice: rollDiceTool,
  apply_damage: applyDamageTool,
  heal: healTool,
  add_item: addItemTool,
  remove_item: removeItemTool,
  add_condition: addConditionTool,
  remove_condition: removeConditionTool,
  consume_spell_slot: consumeSpellSlotTool,
  update_ac: updateAcTool,
};

// lookup_entity_history (campagne) et advance_phase (partie) sont absents de gameTools
// (context-free) puisqu'ils doivent être scopés pour ne jamais fuiter entre tables/campagnes —
// le moteur de tour (étape 35) les lie via buildGameTools() à chaque tour.
export function buildGameTools(params: { campaignId: string; partyId: string }) {
  return {
    ...gameTools,
    lookup_entity_history: createLookupEntityHistoryTool(params.campaignId),
    advance_phase: createAdvancePhaseTool(params.partyId),
  };
}

export {
  rollDiceTool,
  rollDice,
  applyDamageTool,
  healTool,
  addItemTool,
  removeItemTool,
  addConditionTool,
  removeConditionTool,
  consumeSpellSlotTool,
  updateAcTool,
  createLookupEntityHistoryTool,
  createAdvancePhaseTool,
};
