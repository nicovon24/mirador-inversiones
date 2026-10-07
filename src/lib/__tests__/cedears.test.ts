import { describe, expect, it } from "vitest";
import { cedearImplied } from "../cedears";

describe("cedearImplied", () => {
  it("calcula el dólar implícito y la brecha", () => {
    // 26.960 × 20 ÷ 334,58 = 1.611,57
    const r = cedearImplied(26960, 334.58, 20, 1560)!;
    expect(r.impliedFx).toBeCloseTo(1611.57, 1);
    expect(r.gap).toBeCloseTo(0.033, 2);
    expect(r.theoreticalPrice).toBeCloseTo(26097.24, 1);
  });

  it("descarta el resultado si la brecha es absurda (ratio desactualizado)", () => {
    expect(cedearImplied(26960, 334.58, 10, 1560)).toBeNull();
  });

  it("rechaza entradas inválidas", () => {
    expect(cedearImplied(0, 100, 10, 1500)).toBeNull();
    expect(cedearImplied(100, 100, 0, 1500)).toBeNull();
  });
});
