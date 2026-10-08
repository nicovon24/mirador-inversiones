import { describe, expect, it } from "vitest";
import { sortHoldings, summarize, valueHolding } from "../portfolio";

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

describe("sortHoldings", () => {
  const h = (symbol: string, currency: "ARS" | "USD", value: number, pnl: number | null, extra: Partial<{ quantity: number; lastPrice: number | null; dayChangePct: number | null }> = {}) => ({
    symbol,
    currency,
    value,
    pnl,
    quantity: extra.quantity ?? 1,
    lastPrice: extra.lastPrice ?? value,
    dayChangePct: extra.dayChangePct ?? null,
  });
  const rows = [h("MELI", "ARS", 1_935_780, 74_460), h("IOLDOLD", "USD", 117, 1.28), h("GGAL", "ARS", 523_740, null), h("SPY", "ARS", 1_878_300, 339_565)];

  it("compara valuaciones en pesos usando el MEP", () => {
    // 117 USD × 20.000 = 2.340.000 ARS: queda primero aunque el número sea chico.
    expect(sortHoldings(rows, "value", "desc", 20_000).map((r) => r.symbol)).toEqual(["IOLDOLD", "MELI", "SPY", "GGAL"]);
    expect(sortHoldings(rows, "value", "desc", 1_500).map((r) => r.symbol)).toEqual(["MELI", "SPY", "GGAL", "IOLDOLD"]);
  });

  it("deja las filas sin dato al final en ambas direcciones", () => {
    expect(sortHoldings(rows, "pnl", "desc", 1_500).at(-1)!.symbol).toBe("GGAL");
    expect(sortHoldings(rows, "pnl", "asc", 1_500).at(-1)!.symbol).toBe("GGAL");
    expect(sortHoldings(rows, "pnl", "asc", 1_500)[0].symbol).toBe("IOLDOLD");
  });

  it("ordena por ticker y desempata por ticker", () => {
    expect(sortHoldings(rows, "symbol", "asc", null).map((r) => r.symbol)).toEqual(["GGAL", "IOLDOLD", "MELI", "SPY"]);
    const tied = [h("B", "ARS", 10, 1, { quantity: 5 }), h("A", "ARS", 10, 1, { quantity: 5 })];
    expect(sortHoldings(tied, "quantity", "desc", null).map((r) => r.symbol)).toEqual(["A", "B"]);
  });

  it("no modifica el arreglo original", () => {
    const copy = [...rows];
    sortHoldings(rows, "value", "asc", 1_500);
    expect(rows).toEqual(copy);
  });
});
