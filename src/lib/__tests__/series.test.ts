import { describe, expect, it } from "vitest";
import { downsample, parsePeriod, periodChangePct, sampleIndices } from "../series";

describe("downsample", () => {
  it("no toca series cortas", () => {
    expect(downsample([1, 2, 3], 48)).toEqual([1, 2, 3]);
  });

  it("reduce a n puntos conservando el primero y el último", () => {
    const values = Array.from({ length: 250 }, (_, i) => i);
    const out = downsample(values, 48);
    expect(out).toHaveLength(48);
    expect(out[0]).toBe(0);
    expect(out.at(-1)).toBe(249);
    expect([...out].sort((a, b) => a - b)).toEqual(out); // mantiene el orden
  });

  it("descarta valores no finitos", () => {
    expect(downsample([1, NaN, 3, Infinity], 48)).toEqual([1, 3]);
  });
});

describe("periodChangePct", () => {
  it("compara el primer cierre con el último", () => {
    expect(periodChangePct([100, 90, 110])).toBeCloseTo(10);
    expect(periodChangePct([200, 150])).toBeCloseTo(-25);
  });

  it("usa el precio en vivo si se conoce", () => {
    expect(periodChangePct([100, 105], 120)).toBeCloseTo(20);
    expect(periodChangePct([100], 120)).toBeCloseTo(20);
  });

  it("devuelve null sin datos suficientes o con base inválida", () => {
    expect(periodChangePct([])).toBeNull();
    expect(periodChangePct([100])).toBeNull();
    expect(periodChangePct([0, 10])).toBeNull();
  });
});

describe("parsePeriod", () => {
  it("acepta solo los rangos ofrecidos y si no usa 1M", () => {
    expect(parsePeriod("3M")).toBe("3M");
    expect(parsePeriod("1D")).toBe("1M");
    expect(parsePeriod("x")).toBe("1M");
    expect(parsePeriod(undefined)).toBe("1M");
  });
});

describe("sampleIndices", () => {
  it("devuelve los mismos índices para fechas y precios, con extremos incluidos", () => {
    const idx = sampleIndices(100, 10);
    expect(idx).toHaveLength(10);
    expect(idx[0]).toBe(0);
    expect(idx.at(-1)).toBe(99);
    expect(sampleIndices(3, 10)).toEqual([0, 1, 2]);
  });
});
