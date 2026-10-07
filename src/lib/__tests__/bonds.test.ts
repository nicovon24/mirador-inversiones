import { describe, expect, it } from "vitest";
import { bondMetrics, bondTicker, buildSchedule, findBond } from "../bonds";

const SETTLE = new Date("2026-10-07T21:00:00-03:00");

describe("bondTicker", () => {
  it("unifica las especies en pesos, MEP y cable", () => {
    expect(bondTicker("GD35D")).toBe("GD35");
    expect(bondTicker("AL35C")).toBe("AL35");
    expect(bondTicker("AL35")).toBe("AL35");
    expect(findBond("ae38d")?.ticker).toBe("AE38");
    expect(findBond("AAPL")).toBeUndefined();
  });
});

describe("buildSchedule", () => {
  it("devuelve el 100 % del capital y cierra en cero", () => {
    for (const ticker of ["AL35", "GD35", "AE38", "GD38", "AL41", "GD41", "GD46"]) {
      const bond = findBond(ticker)!;
      const flows = buildSchedule(bond);
      const paid = flows.reduce((s, f) => s + f.amortization, 0);
      expect(paid).toBeCloseTo(bond.openingBalance, 4);
      expect(flows.at(-1)!.residual).toBe(0);
      expect(flows.at(-1)!.date).toBe(bond.maturity);
    }
  });

  it("coincide con el cronograma publicado de AL41", () => {
    const f = buildSchedule(findBond("AL41")!);
    expect(f[0].total).toBeCloseTo(1.75, 6);
    expect(f[2].total).toBeCloseTo(5.32, 6);
    expect(f[6].interest).toBeCloseTo(2.089425, 6);
    expect(f.at(-1)!.amortization).toBeCloseTo(3.61, 6);
  });

  it("coincide con el cronograma publicado de AE38 y GD46", () => {
    expect(buildSchedule(findBond("AE38")!)[1].total).toBeCloseTo(7.04, 6);
    expect(buildSchedule(findBond("AE38")!).at(-1)!.total).toBeCloseTo(4.7765, 6);
    expect(buildSchedule(findBond("GD46")!)[0].interest).toBeCloseTo(1.875225, 5);
  });
});

describe("bondMetrics", () => {
  it("AL35 con precio sucio 71,39 USD se parece a la TIR y duration de IOL", () => {
    const m = bondMetrics(findBond("AL35")!, 71.39, SETTLE);
    expect(m.accrued).toBeCloseTo(1.0, 1);
    expect(m.technicalValue).toBeCloseTo(101.0, 1);
    expect(m.tir).toBeGreaterThan(0.115);
    expect(m.tir).toBeLessThan(0.121);
    expect(m.macaulay).toBeCloseTo(5.29, 0);
    expect(m.parity).toBeCloseTo(0.707, 2);
  });

  it("si el precio sube, la TIR baja", () => {
    const bond = findBond("GD38")!;
    const cheap = bondMetrics(bond, 70, SETTLE).tir!;
    const dear = bondMetrics(bond, 80, SETTLE).tir!;
    expect(dear).toBeLessThan(cheap);
  });

  it("sin precio no calcula rendimiento", () => {
    const m = bondMetrics(findBond("GD41")!, null, SETTLE);
    expect(m.tir).toBeNull();
    expect(m.parity).toBeNull();
    expect(m.nextPayment?.date).toBe("2027-01-09");
  });
});
