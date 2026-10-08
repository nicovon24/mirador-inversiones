import Decimal from "decimal.js";

export interface HoldingInput {
  quantity: string | number;
  /** Precio promedio de compra (PPC). null si se desconoce. */
  avgPrice: string | number | null;
  lastPrice: string | number;
  currency: "ARS" | "USD";
  /** Los bonos en IOL cotizan cada 100 nominales. */
  priceDivisor?: number;
}

export interface HoldingResult {
  value: number;
  cost: number | null;
  pnl: number | null;
  pnlPct: number | null;
}

export function valueHolding(h: HoldingInput): HoldingResult {
  const qty = new Decimal(h.quantity);
  const div = new Decimal(h.priceDivisor ?? 1);
  const value = qty.times(h.lastPrice).div(div);
  if (h.avgPrice == null) return { value: value.toNumber(), cost: null, pnl: null, pnlPct: null };
  const cost = qty.times(h.avgPrice).div(div);
  const pnl = value.minus(cost);
  return {
    value: value.toDecimalPlaces(2).toNumber(),
    cost: cost.toDecimalPlaces(2).toNumber(),
    pnl: pnl.toDecimalPlaces(2).toNumber(),
    pnlPct: cost.isZero() ? null : pnl.div(cost).times(100).toDecimalPlaces(2).toNumber(),
  };
}

export interface SummaryRow {
  value: number;
  cost: number | null;
  currency: "ARS" | "USD";
  dayChangePct?: number | null;
}

export interface PortfolioSummary {
  /** Total expresado en pesos (USD convertidos al MEP). */
  totalArs: number;
  /** Total expresado en dólares MEP. */
  totalUsd: number | null;
  pnlArs: number | null;
  pnlPct: number | null;
  /** Variación del día ponderada por valor. */
  dayPnlArs: number;
}

/** Suma posiciones en ARS y USD llevándolas a una misma moneda con el dólar MEP. */
export function summarize(rows: SummaryRow[], mep: number | null): PortfolioSummary {
  const toArs = (v: Decimal.Value, currency: "ARS" | "USD") =>
    currency === "USD" ? (mep ? new Decimal(v).times(mep) : new Decimal(0)) : new Decimal(v);

  let total = new Decimal(0);
  let cost = new Decimal(0);
  let costKnown = new Decimal(0); // valor actual de las posiciones con costo conocido
  let day = new Decimal(0);

  for (const r of rows) {
    const value = toArs(r.value, r.currency);
    total = total.plus(value);
    if (r.cost != null) {
      cost = cost.plus(toArs(r.cost, r.currency));
      costKnown = costKnown.plus(value);
    }
    if (r.dayChangePct != null) {
      // valor de ayer = valor / (1 + var%) → resultado del día = valor − ayer
      const prev = value.div(new Decimal(1).plus(new Decimal(r.dayChangePct).div(100)));
      day = day.plus(value.minus(prev));
    }
  }

  const pnl = cost.isZero() ? null : costKnown.minus(cost);
  return {
    totalArs: total.toDecimalPlaces(2).toNumber(),
    totalUsd: mep ? total.div(mep).toDecimalPlaces(2).toNumber() : null,
    pnlArs: pnl ? pnl.toDecimalPlaces(2).toNumber() : null,
    pnlPct: pnl ? pnl.div(cost).times(100).toDecimalPlaces(2).toNumber() : null,
    dayPnlArs: day.toDecimalPlaces(2).toNumber(),
  };
}

// ---------- Orden de la tabla de tenencias ----------

export type HoldingSortKey = "symbol" | "quantity" | "lastPrice" | "dayChangePct" | "value" | "pnl";

export interface SortableHolding {
  symbol: string;
  currency: "ARS" | "USD";
  quantity: number;
  lastPrice: number | null;
  dayChangePct: number | null;
  value: number;
  pnl: number | null;
}

/** Dirección con la que arranca cada columna: el ticker A→Z, los números de mayor a menor. */
export const holdingNaturalDir = (k: HoldingSortKey): "asc" | "desc" => (k === "symbol" ? "asc" : "desc");

/**
 * Ordena tenencias por columna. Los montos (último, valuación, resultado) se comparan en pesos con el MEP
 * porque la cartera mezcla ARS y USD; sin MEP se comparan tal cual. Las filas sin dato van siempre al final.
 */
export function sortHoldings<T extends SortableHolding>(rows: T[], key: HoldingSortKey, dir: "asc" | "desc", mep: number | null): T[] {
  const sign = dir === "asc" ? 1 : -1;
  const inArs = (v: number | null, currency: "ARS" | "USD") => (v == null ? null : currency === "USD" && mep ? v * mep : v);
  const pick = (r: T): number | null => {
    switch (key) {
      case "quantity":
        return r.quantity;
      case "lastPrice":
        return inArs(r.lastPrice, r.currency);
      case "dayChangePct":
        return r.dayChangePct;
      case "value":
        return inArs(r.value, r.currency);
      case "pnl":
        return inArs(r.pnl, r.currency);
      default:
        return null;
    }
  };
  return [...rows].sort((a, b) => {
    if (key === "symbol") return a.symbol.localeCompare(b.symbol, "es") * sign;
    const va = pick(a);
    const vb = pick(b);
    if (va === null && vb === null) return a.symbol.localeCompare(b.symbol, "es");
    if (va === null) return 1;
    if (vb === null) return -1;
    return (va - vb) * sign || a.symbol.localeCompare(b.symbol, "es");
  });
}
