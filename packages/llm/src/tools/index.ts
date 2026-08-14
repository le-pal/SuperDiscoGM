import { rollDiceTool } from "./dice";
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

export { rollDiceTool, applyDamageTool, healTool, addItemTool, removeItemTool, addConditionTool, removeConditionTool, consumeSpellSlotTool, updateAcTool };
