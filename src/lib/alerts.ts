import Decimal from "decimal.js";

export type AlertCondition = "ABOVE" | "BELOW" | "PCT_CHANGE";

export interface AlertRule {
  condition: AlertCondition;
  target: string | number;
  basePrice?: string | number | null;
}

/** ¿El precio actual dispara la alerta? Comparaciones con Decimal (RNF-04). */
export function isTriggered(rule: AlertRule, price: number): boolean {
  if (!Number.isFinite(price) || price <= 0) return false;
  const p = new Decimal(price);
  const target = new Decimal(rule.target);
  switch (rule.condition) {
    case "ABOVE":
      return p.gte(target);
    case "BELOW":
      return p.lte(target);
    case "PCT_CHANGE": {
      if (rule.basePrice == null) return false;
      const base = new Decimal(rule.basePrice);
      if (base.lte(0)) return false;
      return p.minus(base).abs().div(base).times(100).gte(target.abs());
    }
  }
}

/**
 * Distancia hasta el objetivo, en % del precio actual (positiva = falta subir).
 * Para PCT_CHANGE devuelve cuánto se movió ya desde la base.
 */
export function distanceToTarget(rule: AlertRule, price: number): number | null {
  if (!(price > 0)) return null;
  if (rule.condition === "PCT_CHANGE") {
    if (rule.basePrice == null) return null;
    const base = new Decimal(rule.basePrice);
    return new Decimal(price).minus(base).div(base).times(100).toNumber();
  }
  return new Decimal(rule.target).minus(price).div(price).times(100).toNumber();
}

export function describeRule(rule: AlertRule, fmt: (n: number) => string): string {
  const t = Number(rule.target);
  switch (rule.condition) {
    case "ABOVE":
      return `Sube a ${fmt(t)}`;
    case "BELOW":
      return `Baja a ${fmt(t)}`;
    case "PCT_CHANGE":
      return `Se mueve ±${fmt(t)} %`;
  }
}
