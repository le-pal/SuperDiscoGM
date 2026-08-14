import { describe, it, expect } from "vitest";
import { rollDiceTool } from "./dice";

// rollDiceTool.execute est appelable directement (vérifié empiriquement : le SDK `ai` accepte
// un 2e argument d'options mais nos execute() ne l'utilisent pas, {} suffit).
async function roll(formula: string) {
  if (!rollDiceTool.execute) throw new Error("rollDiceTool.execute manquant");
  // @ts-expect-error — signature exacte des options non exportée par le SDK, {} accepté en pratique
  return rollDiceTool.execute({ formula }, {});
}

describe("rollDiceTool — schéma", () => {
  it("accepte une formule simple NdM", () => {
    expect(rollDiceTool.inputSchema.safeParse({ formula: "1d20" }).success).toBe(true);
  });

  it("accepte une formule avec modificateur positif ou négatif", () => {
    expect(rollDiceTool.inputSchema.safeParse({ formula: "2d6+3" }).success).toBe(true);
    expect(rollDiceTool.inputSchema.safeParse({ formula: "1d20-1" }).success).toBe(true);
  });

  it("rejette une formule invalide", () => {
    expect(rollDiceTool.inputSchema.safeParse({ formula: "abc" }).success).toBe(false);
    expect(rollDiceTool.inputSchema.safeParse({ formula: "20d" }).success).toBe(false);
    expect(rollDiceTool.inputSchema.safeParse({ formula: "d20" }).success).toBe(false);
  });
});

describe("rollDiceTool — execute (propriétés statistiques, résultat aléatoire)", () => {
  it("lance exactement N dés pour NdM", async () => {
    for (let i = 0; i < 50; i++) {
      const result = await roll("4d6");
      expect(result.rolls).toHaveLength(4);
    }
  });

  it("chaque dé individuel reste dans [1, M]", async () => {
    for (let i = 0; i < 50; i++) {
      const result = await roll("10d8");
      for (const value of result.rolls) {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(8);
      }
    }
  });

  it("le total = somme des dés + modificateur", async () => {
    for (let i = 0; i < 50; i++) {
      const result = await roll("3d6+2");
      const sum = result.rolls.reduce((a: number, b: number) => a + b, 0);
      expect(result.total).toBe(sum + 2);
    }
  });

  it("gère un modificateur négatif dans le total", async () => {
    const result = await roll("1d20-5");
    expect(result.modifier).toBe(-5);
    expect(result.total).toBe(result.rolls[0] - 5);
  });

  it("gère l'absence de modificateur (0 par défaut)", async () => {
    const result = await roll("2d10");
    expect(result.modifier).toBe(0);
  });
});
