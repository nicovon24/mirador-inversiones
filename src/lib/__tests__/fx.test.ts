import { describe, expect, it } from "vitest";
import { impliedChangePct, impliedRate } from "../market/fx";

describe("dólar implícito", () => {
  it("calcula MEP como AL30 / AL30D", () => {
    expect(impliedRate(85850, 55.82)).toBe(1537.98);
  });

  it("devuelve null con precios inválidos", () => {
    expect(impliedRate(0, 55)).toBeNull();
    expect(impliedRate(85000, 0)).toBeNull();
  });

  it("combina las variaciones de ambas especies", () => {
    // pesos +1 %, dólares +1 % → el tipo de cambio no se mueve
    expect(impliedChangePct(1, 1)).toBe(0);
    // pesos +2 %, dólares 0 % → sube 2 %
    expect(impliedChangePct(2, 0)).toBe(2);
    // pesos 0 %, dólares +1 % → baja ~0,99 %
    expect(impliedChangePct(0, 1)).toBe(-0.99);
  });
});
