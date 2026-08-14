import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@superdiscogm/db";
import * as logic from "./characterSheetLogic";
import type { InventoryItem } from "./characterSheetLogic";

// Adaptateur DB + journalisation autour de characterSheetLogic.ts (logique pure, testée à part).
// Chaque outil écrit dans CharacterSheetLog (toolName/argsJson/resultJson) [Q31b] — la narration
// suit ce qui a été appliqué, jamais l'inverse. Jamais improvisé en texte libre par le MJ-IA [Q32b].

async function applySheetChange<T>(
  characterSheetId: string,
  toolName: string,
  args: Record<string, unknown>,
  mutate: (sheet: NonNullable<Awaited<ReturnType<typeof prisma.characterSheet.findUnique>>>) => Promise<T>
): Promise<T> {
  const sheet = await prisma.characterSheet.findUniqueOrThrow({ where: { id: characterSheetId } });
  const result = await mutate(sheet);
  await prisma.characterSheetLog.create({
    // Prisma exige InputJsonValue (union stricte) pour les colonnes Json — nos objets/tableaux
    // TS-typés (InventoryItem[], Record<string, unknown>...) le satisfont à l'exécution mais pas
    // structurellement pour le compilateur ; cast ciblé plutôt que traquer le type exact réexporté.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { characterSheetId, toolName, argsJson: args as any, resultJson: result as any },
  });
  return result;
}

const characterSheetIdSchema = { characterSheetId: z.string() };

export const applyDamageTool = tool({
  description: "Applique des dégâts à un personnage (PV plafonnés à 0, jamais négatifs).",
  inputSchema: z.object({ ...characterSheetIdSchema, amount: z.number().int().positive() }),
  execute: async ({ characterSheetId, amount }) =>
    applySheetChange(characterSheetId, "apply_damage", { amount }, async (sheet) => {
      const hp = logic.applyDamage(sheet.hp, amount);
      await prisma.characterSheet.update({ where: { id: characterSheetId }, data: { hp } });
      return { hp, hpMax: sheet.hpMax };
    }),
});

export const healTool = tool({
  description: "Soigne un personnage (PV plafonnés à hpMax).",
  inputSchema: z.object({ ...characterSheetIdSchema, amount: z.number().int().positive() }),
  execute: async ({ characterSheetId, amount }) =>
    applySheetChange(characterSheetId, "heal", { amount }, async (sheet) => {
      const hp = logic.applyHeal(sheet.hp, sheet.hpMax, amount);
      await prisma.characterSheet.update({ where: { id: characterSheetId }, data: { hp } });
      return { hp, hpMax: sheet.hpMax };
    }),
});

export const addItemTool = tool({
  description: "Ajoute un objet (ou une quantité) à l'inventaire d'un personnage.",
  inputSchema: z.object({ ...characterSheetIdSchema, item: z.string(), quantity: z.number().int().positive().default(1) }),
  execute: async ({ characterSheetId, item, quantity }) =>
    applySheetChange(characterSheetId, "add_item", { item, quantity }, async (sheet) => {
      const inventory = logic.addItem((sheet.inventory as InventoryItem[] | null) ?? [], item, quantity);
      await prisma.characterSheet.update({ where: { id: characterSheetId }, data: { inventory: inventory as any } });
      return { inventory };
    }),
});

export const removeItemTool = tool({
  description: "Retire un objet (ou une quantité) de l'inventaire d'un personnage.",
  inputSchema: z.object({ ...characterSheetIdSchema, item: z.string(), quantity: z.number().int().positive().default(1) }),
  execute: async ({ characterSheetId, item, quantity }) =>
    applySheetChange(characterSheetId, "remove_item", { item, quantity }, async (sheet) => {
      const inventory = logic.removeItem((sheet.inventory as InventoryItem[] | null) ?? [], item, quantity);
      await prisma.characterSheet.update({ where: { id: characterSheetId }, data: { inventory: inventory as any } });
      return { inventory };
    }),
});

export const addConditionTool = tool({
  description: "Ajoute une condition active à un personnage (ex: empoisonné, à terre).",
  inputSchema: z.object({ ...characterSheetIdSchema, condition: z.string() }),
  execute: async ({ characterSheetId, condition }) =>
    applySheetChange(characterSheetId, "add_condition", { condition }, async (sheet) => {
      const conditions = logic.addCondition((sheet.conditions as string[] | null) ?? [], condition);
      await prisma.characterSheet.update({ where: { id: characterSheetId }, data: { conditions } });
      return { conditions };
    }),
});

export const removeConditionTool = tool({
  description: "Retire une condition active d'un personnage.",
  inputSchema: z.object({ ...characterSheetIdSchema, condition: z.string() }),
  execute: async ({ characterSheetId, condition }) =>
    applySheetChange(characterSheetId, "remove_condition", { condition }, async (sheet) => {
      const conditions = logic.removeCondition((sheet.conditions as string[] | null) ?? [], condition);
      await prisma.characterSheet.update({ where: { id: characterSheetId }, data: { conditions } });
      return { conditions };
    }),
});

export const consumeSpellSlotTool = tool({
  description: "Consomme un emplacement de sort d'un niveau donné (jamais en dessous de 0).",
  inputSchema: z.object({ ...characterSheetIdSchema, level: z.number().int().min(1).max(9) }),
  execute: async ({ characterSheetId, level }) =>
    applySheetChange(characterSheetId, "consume_spell_slot", { level }, async (sheet) => {
      const spellSlots = logic.consumeSpellSlot((sheet.spellSlots as Record<string, number> | null) ?? {}, level);
      await prisma.characterSheet.update({ where: { id: characterSheetId }, data: { spellSlots } });
      return { spellSlots };
    }),
});

export const updateAcTool = tool({
  description: "Met à jour la classe d'armure d'un personnage (ex: après avoir équipé/retiré une armure).",
  inputSchema: z.object({ ...characterSheetIdSchema, ac: z.number().int().min(0) }),
  execute: async ({ characterSheetId, ac }) =>
    applySheetChange(characterSheetId, "update_ac", { ac }, async () => {
      await prisma.characterSheet.update({ where: { id: characterSheetId }, data: { ac } });
      return { ac };
    }),
});
