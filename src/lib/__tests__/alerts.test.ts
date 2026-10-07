import { describe, expect, it } from "vitest";
import { describeRule, distanceToTarget, isTriggered } from "../alerts";

describe("isTriggered", () => {
  it("ABOVE dispara al llegar o superar", () => {
    expect(isTriggered({ condition: "ABOVE", target: "100" }, 99.99)).toBe(false);
    expect(isTriggered({ condition: "ABOVE", target: "100" }, 100)).toBe(true);
    expect(isTriggered({ condition: "ABOVE", target: "100" }, 101)).toBe(true);
  });

  it("BELOW dispara al llegar o perforar", () => {
    expect(isTriggered({ condition: "BELOW", target: "50.5" }, 50.51)).toBe(false);
    expect(isTriggered({ condition: "BELOW", target: "50.5" }, 50.5)).toBe(true);
  });

  it("PCT_CHANGE mide el movimiento absoluto desde la base", () => {
    const rule = { condition: "PCT_CHANGE" as const, target: "5", basePrice: "200" };
    expect(isTriggered(rule, 209.99)).toBe(false);
    expect(isTriggered(rule, 210)).toBe(true);
    expect(isTriggered(rule, 190)).toBe(true);
  });

  it("no dispara sin base o con precio inválido", () => {
    expect(isTriggered({ condition: "PCT_CHANGE", target: "5" }, 100)).toBe(false);
    expect(isTriggered({ condition: "ABOVE", target: "1" }, 0)).toBe(false);
    expect(isTriggered({ condition: "ABOVE", target: "1" }, Number.NaN)).toBe(false);
  });

  it("no sufre errores de punto flotante", () => {
    // 0.1 + 0.2 = 0.30000000000000004 en float
    expect(isTriggered({ condition: "BELOW", target: "0.3" }, 0.1 + 0.2)).toBe(false);
    expect(isTriggered({ condition: "ABOVE", target: "0.3" }, 0.1 + 0.2)).toBe(true);
  });
});

describe("distanceToTarget", () => {
  it("es positiva cuando falta subir", () => {
    expect(distanceToTarget({ condition: "ABOVE", target: "110" }, 100)).toBe(10);
  });
  it("en PCT_CHANGE informa el movimiento acumulado", () => {
    expect(distanceToTarget({ condition: "PCT_CHANGE", target: "5", basePrice: "100" }, 97)).toBe(-3);
  });
});

it("describeRule arma un texto legible", () => {
  expect(describeRule({ condition: "BELOW", target: "10" }, (n) => n.toFixed(2))).toBe("Baja a 10.00");
});
