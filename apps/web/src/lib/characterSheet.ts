// Vue normalisée d'une fiche de personnage — les colonnes Json de Prisma (stats/inventory/
// conditions/spellSlots) arrivent typées `JsonValue` (unknown structurellement) ; ce module
// centralise le cast une seule fois plutôt que de le répéter dans chaque composant/page.
export interface InventoryItem {
  name: string;
  quantity: number;
}

export interface CharacterSheetView {
  id: string;
  name: string;
  className: string;
  race: string;
  level: number;
  hp: number;
  hpMax: number;
  ac: number;
  stats: Record<string, number>;
  inventory: InventoryItem[];
  conditions: string[];
  spellSlots: Record<string, number>;
}

export function toCharacterSheetView(sheet: {
  id: string;
  name: string;
  className: string;
  race: string;
  level: number;
  hp: number;
  hpMax: number;
  ac: number;
  stats: unknown;
  inventory: unknown;
  conditions: unknown;
  spellSlots: unknown;
}): CharacterSheetView {
  return {
    id: sheet.id,
    name: sheet.name,
    className: sheet.className,
    race: sheet.race,
    level: sheet.level,
    hp: sheet.hp,
    hpMax: sheet.hpMax,
    ac: sheet.ac,
    stats: (sheet.stats as Record<string, number> | null) ?? {},
    inventory: (sheet.inventory as InventoryItem[] | null) ?? [],
    conditions: (sheet.conditions as string[] | null) ?? [],
    spellSlots: (sheet.spellSlots as Record<string, number> | null) ?? {},
  };
}

const TOOL_LABELS: Record<string, (args: Record<string, unknown>) => string> = {
  apply_damage: (a) => `− ${a.amount} PV`,
  heal: (a) => `+ ${a.amount} PV`,
  add_item: (a) => `+ ${a.item}${Number(a.quantity) > 1 ? ` ×${a.quantity}` : ""}`,
  remove_item: (a) => `− ${a.item}${Number(a.quantity) > 1 ? ` ×${a.quantity}` : ""}`,
  add_condition: (a) => `+ condition « ${a.condition} »`,
  remove_condition: (a) => `− condition « ${a.condition} »`,
  consume_spell_slot: (a) => `Emplacement de sort niveau ${a.level} consommé`,
  update_ac: (a) => `CA mise à jour : ${a.ac}`,
  level_up: (a) => `Niveau supérieur (+${a.hpGain} PV max)`,
};

// Chaque ligne correspond à un tool-call déterministe, jamais une improvisation en texte libre
// du MJ-IA [Q31b] — cf maquette/fiche-personnage.html §"Journal des modifications".
export function formatLogEntry(log: { toolName: string; argsJson: unknown }): string {
  const format = TOOL_LABELS[log.toolName];
  const args = (log.argsJson as Record<string, unknown> | null) ?? {};
  return format ? format(args) : log.toolName;
}
