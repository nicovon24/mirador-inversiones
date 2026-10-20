import { describe, expect, it } from "vitest";
import { convertPortfolioAmount } from "../portfolio-currency";

describe("convertPortfolioAmount", () => {
  it("convierte pesos al dólar elegido y mantiene los instrumentos en USD", () => {
    expect(convertPortfolioAmount(1500, "ARS", "MEP", 1500)).toBe(1);
    expect(convertPortfolioAmount(1500, "ARS", "BLUE", 1250)).toBe(1.2);
    expect(convertPortfolioAmount(2, "USD", "BLUE", 1250)).toBe(2);
  });

  it("convierte USD a pesos al MEP y no inventa montos si falta la cotización", () => {
    expect(convertPortfolioAmount(2, "USD", "ARS", 1500)).toBe(3000);
    expect(convertPortfolioAmount(2, "USD", "ARS", null)).toBeNull();
    expect(convertPortfolioAmount(1500, "ARS", "BLUE", null)).toBeNull();
    expect(convertPortfolioAmount(2, "USD", "BLUE", null)).toBe(2);
  });
});
