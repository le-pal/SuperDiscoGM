// Logique pure du moteur de règles [Q32b] — séparée des tools ai/Prisma (characterSheet.ts)
// exprès pour rester testable sans DB. Chaque fonction est le "vrai" comportement déterministe ;
// characterSheet.ts n'est qu'un adaptateur DB + journalisation autour de ces fonctions.

export interface InventoryItem {
  name: string;
  quantity: number;
}

export function applyDamage(hp: number, amount: number): number {
  return Math.max(0, hp - amount);
}

export function applyHeal(hp: number, hpMax: number, amount: number): number {
  return Math.min(hpMax, hp + amount);
}

export function addItem(inventory: InventoryItem[], item: string, quantity: number): InventoryItem[] {
  const existing = inventory.find((i) => i.name === item);
  if (existing) {
    return inventory.map((i) => (i.name === item ? { ...i, quantity: i.quantity + quantity } : i));
  }
  return [...inventory, { name: item, quantity }];
}

export function removeItem(inventory: InventoryItem[], item: string, quantity: number): InventoryItem[] {
  return inventory
    .map((i) => (i.name === item ? { ...i, quantity: i.quantity - quantity } : i))
    .filter((i) => i.quantity > 0);
}

export function addCondition(conditions: string[], condition: string): string[] {
  return conditions.includes(condition) ? conditions : [...conditions, condition];
}

export function removeCondition(conditions: string[], condition: string): string[] {
  return conditions.filter((c) => c !== condition);
}

export function consumeSpellSlot(spellSlots: Record<string, number>, level: number): Record<string, number> {
  const key = String(level);
  const remaining = Math.max(0, (spellSlots[key] ?? 0) - 1);
  return { ...spellSlots, [key]: remaining };
}
