import { describe, expect, it } from "vitest";
import { formatMoney, formatNumber, formatPercent, formatSigned, trend } from "../format";

describe("format es-AR", () => {
  it("usa punto para miles y coma para decimales", () => {
    expect(formatNumber(1234.567)).toBe("1.234,57");
    expect(formatNumber(1234567, 0)).toBe("1.234.567");
  });

  it("prefija la moneda", () => {
    expect(formatMoney(1500.5)).toBe("$ 1.500,50");
    expect(formatMoney(10, "USD")).toBe("US$ 10,00");
  });

  it("muestra siempre el signo en variaciones", () => {
    expect(formatPercent(1.234)).toBe("+1,23 %");
    expect(formatPercent(-0.5)).toBe("−0,50 %");
    expect(formatPercent(0)).toBe("0,00 %");
    expect(formatSigned(-12.3)).toBe("−12,30");
  });

  it("tolera valores vacíos", () => {
    expect(formatNumber(null)).toBe("—");
    expect(formatPercent(undefined)).toBe("—");
    expect(formatNumber("abc")).toBe("—");
  });

  it("clasifica la tendencia", () => {
    expect(trend(2)).toBe("up");
    expect(trend(-1)).toBe("down");
    expect(trend(0)).toBe("flat");
  });
});
