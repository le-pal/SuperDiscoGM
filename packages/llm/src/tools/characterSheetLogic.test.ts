import { describe, it, expect } from "vitest";
import {
  applyDamage,
  applyHeal,
  addItem,
  removeItem,
  addCondition,
  removeCondition,
  consumeSpellSlot,
} from "./characterSheetLogic";

describe("applyDamage", () => {
  it("soustrait les dégâts des PV", () => {
    expect(applyDamage(20, 5)).toBe(15);
  });

  it("ne descend jamais sous 0", () => {
    expect(applyDamage(5, 100)).toBe(0);
  });

  it("gère exactement 0 dégât restant", () => {
    expect(applyDamage(10, 10)).toBe(0);
  });
});

describe("applyHeal", () => {
  it("ajoute les PV soignés", () => {
    expect(applyHeal(10, 30, 5)).toBe(15);
  });

  it("ne dépasse jamais hpMax", () => {
    expect(applyHeal(28, 30, 100)).toBe(30);
  });

  it("gère exactement hpMax atteint", () => {
    expect(applyHeal(20, 30, 10)).toBe(30);
  });
});

describe("addItem", () => {
  it("ajoute un nouvel objet à l'inventaire vide", () => {
    expect(addItem([], "Épée", 1)).toEqual([{ name: "Épée", quantity: 1 }]);
  });

  it("incrémente la quantité d'un objet déjà présent au lieu de dupliquer l'entrée", () => {
    const inventory = [{ name: "Flèche", quantity: 5 }];
    const result = addItem(inventory, "Flèche", 3);
    expect(result).toEqual([{ name: "Flèche", quantity: 8 }]);
    expect(result).toHaveLength(1);
  });

  it("laisse les autres objets inchangés", () => {
    const inventory = [{ name: "Épée", quantity: 1 }, { name: "Bouclier", quantity: 1 }];
    const result = addItem(inventory, "Épée", 1);
    expect(result.find((i) => i.name === "Bouclier")).toEqual({ name: "Bouclier", quantity: 1 });
  });
});

describe("removeItem", () => {
  it("décrémente la quantité", () => {
    const inventory = [{ name: "Flèche", quantity: 5 }];
    expect(removeItem(inventory, "Flèche", 2)).toEqual([{ name: "Flèche", quantity: 3 }]);
  });

  it("fait disparaître l'entrée si on retire plus que la quantité présente (jamais négatif)", () => {
    const inventory = [{ name: "Flèche", quantity: 2 }];
    const result = removeItem(inventory, "Flèche", 10);
    expect(result.find((i) => i.name === "Flèche")).toBeUndefined();
  });

  it("fait disparaître l'entrée à quantité exactement 0", () => {
    const inventory = [{ name: "Flèche", quantity: 3 }];
    expect(removeItem(inventory, "Flèche", 3)).toEqual([]);
  });

  it("ne touche pas aux objets absents de l'inventaire", () => {
    const inventory = [{ name: "Épée", quantity: 1 }];
    expect(removeItem(inventory, "Bouclier", 1)).toEqual(inventory);
  });
});

describe("addCondition", () => {
  it("ajoute une nouvelle condition", () => {
    expect(addCondition([], "empoisonné")).toEqual(["empoisonné"]);
  });

  it("est idempotent : n'ajoute pas de doublon si déjà présente", () => {
    const result = addCondition(["empoisonné"], "empoisonné");
    expect(result).toEqual(["empoisonné"]);
    expect(result).toHaveLength(1);
  });
});

describe("removeCondition", () => {
  it("retire la condition indiquée", () => {
    expect(removeCondition(["empoisonné", "à terre"], "empoisonné")).toEqual(["à terre"]);
  });

  it("ne fait rien si la condition n'est pas présente", () => {
    expect(removeCondition(["à terre"], "empoisonné")).toEqual(["à terre"]);
  });
});

describe("consumeSpellSlot", () => {
  it("décrémente l'emplacement du niveau demandé", () => {
    expect(consumeSpellSlot({ "1": 3 }, 1)).toEqual({ "1": 2 });
  });

  it("ne descend jamais sous 0", () => {
    expect(consumeSpellSlot({ "1": 0 }, 1)).toEqual({ "1": 0 });
  });

  it("gère un niveau non présent comme 0 emplacement (reste à 0, pas négatif)", () => {
    expect(consumeSpellSlot({}, 3)).toEqual({ "3": 0 });
  });

  it("laisse les autres niveaux inchangés", () => {
    expect(consumeSpellSlot({ "1": 3, "2": 2 }, 2)).toEqual({ "1": 3, "2": 1 });
  });
});
