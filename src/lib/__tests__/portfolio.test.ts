import { describe, expect, it } from "vitest";
import { summarize, valueHolding } from "../portfolio";

describe("valueHolding", () => {
  it("calcula valuación y resultado con decimales exactos", () => {
    const r = valueHolding({ quantity: "3", avgPrice: "0.1", lastPrice: "0.2", currency: "ARS" });
    expect(r).toEqual({ value: 0.6, cost: 0.3, pnl: 0.3, pnlPct: 100 });
  });

  it("aplica el divisor de bonos (precio cada 100 nominales)", () => {
    const r = valueHolding({ quantity: 1000, avgPrice: 80000, lastPrice: 85000, currency: "ARS", priceDivisor: 100 });
    expect(r.value).toBe(850000);
    expect(r.pnl).toBe(50000);
  });

  it("sin precio de compra no inventa resultado", () => {
    const r = valueHolding({ quantity: 10, avgPrice: null, lastPrice: 5, currency: "USD" });
    expect(r).toEqual({ value: 50, cost: null, pnl: null, pnlPct: null });
  });
});

describe("summarize", () => {
  it("lleva USD a pesos con el MEP", () => {
    const s = summarize(
      [
        { value: 1000, cost: 800, currency: "ARS" },
        { value: 10, cost: 10, currency: "USD" },
      ],
      1500,
    );
    expect(s.totalArs).toBe(16000);
    expect(s.totalUsd).toBe(10.67);
    expect(s.pnlArs).toBe(200);
    expect(s.pnlPct).toBe(1.27);
  });

  it("calcula el resultado del día a partir de la variación", () => {
    const s = summarize([{ value: 110, cost: null, currency: "ARS", dayChangePct: 10 }], null);
    expect(s.dayPnlArs).toBe(10);
    expect(s.pnlArs).toBeNull();
    expect(s.totalUsd).toBeNull();
  });
});
