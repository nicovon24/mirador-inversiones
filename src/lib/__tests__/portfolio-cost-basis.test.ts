import { describe, expect, it } from "vitest";
import { costBasisKey, parseCostBasis, parsePurchasePrice } from "../portfolio-cost-basis";

describe("PPC ingresado para IOL", () => {
  it("acepta precios positivos con coma o punto decimal", () => {
    expect(parsePurchasePrice("1250,50")).toBe(1250.5);
    expect(parsePurchasePrice("0.00000001")).toBe(0.00000001);
    expect(parsePurchasePrice("0")).toBeNull();
    expect(parsePurchasePrice("1.250,50")).toBeNull();
    expect(parsePurchasePrice("abc")).toBeNull();
  });

  it("descarta entradas locales inválidas y distingue mercado y moneda", () => {
    expect(costBasisKey("AR", "spy", "ARS")).toBe("AR:SPY:ARS");
    expect(parseCostBasis(JSON.stringify({ "AR:SPY:ARS": 100, "US:SPY:USD": 50, "AR:YPF:ARS": -1, x: "900" })))
      .toEqual({ "AR:SPY:ARS": 100, "US:SPY:USD": 50 });
    expect(parseCostBasis("not-json")).toEqual({});
  });
});
