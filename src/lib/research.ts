/** Definición de los datos fundamentales que muestra la pestaña Investigación. Sin dependencias de servidor. */

export type MetricFormat = "ratio" | "pct" | "signedPct" | "money" | "millions" | "times";

export interface MetricDef {
  key: string;
  label: string;
  format: MetricFormat;
  help?: string;
  /** Valor por acción o precio en USD: no se muestra cuando el dato viene de un ADR. */
  perShare?: boolean;
  /** Se compara contra la mediana de empresas comparables. */
  compare?: boolean;
}

export interface MetricGroup {
  id: string;
  title: string;
  description: string;
  metrics: MetricDef[];
}

export const RESEARCH_GROUPS: MetricGroup[] = [
  {
    id: "valuacion",
    title: "Valuación",
    description: "Cuánto pagás por cada peso de ganancia, de patrimonio o de ventas.",
    metrics: [
      { key: "peTTM", label: "PER (12 meses)", format: "ratio", help: "per", compare: true },
      { key: "forwardPE", label: "PER estimado", format: "ratio", help: "per-forward" },
      { key: "pbAnnual", label: "Precio / valor libro", format: "ratio", help: "pb", compare: true },
      { key: "psTTM", label: "Precio / ventas", format: "ratio", help: "ps", compare: true },
      { key: "evEbitdaTTM", label: "EV / EBITDA", format: "ratio", help: "ev-ebitda", compare: true },
    ],
  },
  {
    id: "rentabilidad",
    title: "Rentabilidad",
    description: "Qué tan bien convierte la empresa sus ventas y su capital en ganancias.",
    metrics: [
      { key: "roeTTM", label: "ROE", format: "pct", help: "roe", compare: true },
      { key: "roaTTM", label: "ROA", format: "pct", help: "roa" },
      { key: "grossMarginTTM", label: "Margen bruto", format: "pct", help: "margenes" },
      { key: "operatingMarginTTM", label: "Margen operativo", format: "pct", help: "margenes" },
      { key: "netProfitMarginTTM", label: "Margen neto", format: "pct", help: "margenes", compare: true },
    ],
  },
  {
    id: "crecimiento",
    title: "Crecimiento",
    description: "Cómo evolucionan las ventas y las ganancias en el tiempo.",
    metrics: [
      { key: "revenueGrowthTTMYoy", label: "Ventas, últimos 12 meses vs. año anterior", format: "signedPct", help: "crecimiento", compare: true },
      { key: "revenueGrowth5Y", label: "Ventas, promedio anual 5 años", format: "signedPct", help: "crecimiento" },
      { key: "epsGrowthTTMYoy", label: "Ganancia por acción, 12 meses", format: "signedPct", help: "crecimiento" },
      { key: "epsGrowth5Y", label: "Ganancia por acción, promedio 5 años", format: "signedPct", help: "crecimiento" },
    ],
  },
  {
    id: "salud",
    title: "Salud financiera",
    description: "Cuánto debe la empresa y si puede afrontar sus compromisos.",
    metrics: [
      { key: "totalDebt/totalEquityQuarterly", label: "Deuda / patrimonio", format: "times", help: "deuda-patrimonio", compare: true },
      { key: "currentRatioQuarterly", label: "Liquidez corriente", format: "times", help: "liquidez-corriente" },
      { key: "netInterestCoverageTTM", label: "Cobertura de intereses", format: "times", help: "cobertura-intereses" },
    ],
  },
  {
    id: "dividendos",
    title: "Dividendos",
    description: "Cuánto de la ganancia vuelve al accionista en efectivo.",
    metrics: [
      { key: "currentDividendYieldTTM", label: "Rendimiento por dividendo", format: "pct", help: "dividend-yield", compare: true },
      { key: "payoutRatioTTM", label: "Payout", format: "pct", help: "payout" },
    ],
  },
  {
    id: "precio",
    title: "Precio y riesgo",
    description: "Cómo se movió la acción y cuánto se mueve frente al mercado.",
    metrics: [
      { key: "beta", label: "Beta", format: "ratio", help: "beta" },
      { key: "52WeekPriceReturnDaily", label: "Rendimiento 52 semanas", format: "signedPct" },
      { key: "13WeekPriceReturnDaily", label: "Rendimiento 13 semanas", format: "signedPct" },
      { key: "52WeekHigh", label: "Máximo 52 semanas (USD)", format: "money", help: "maximo-minimo", perShare: true },
      { key: "52WeekLow", label: "Mínimo 52 semanas (USD)", format: "money", help: "maximo-minimo", perShare: true },
      { key: "epsTTM", label: "Ganancia por acción (USD)", format: "money", help: "eps", perShare: true },
      { key: "marketCapitalization", label: "Capitalización", format: "millions", help: "market-cap" },
    ],
  },
];

/** Los ratios que entran en la tabla de comparables. */
export const PEER_METRICS: MetricDef[] = RESEARCH_GROUPS.flatMap((g) => g.metrics).filter((m) => m.compare);

export function median(values: number[]): number | null {
  const v = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** Frase neutral que ubica el dato frente a la mediana de comparables (RF-47). No emite juicio de compra o venta. */
export function compareSentence(value: number | null, peerMedian: number | null): string | null {
  if (value === null || peerMedian === null || peerMedian === 0) return null;
  const diff = (value - peerMedian) / Math.abs(peerMedian);
  if (Math.abs(diff) < 0.1) return "En línea con sus comparables";
  return diff > 0 ? "Por encima de sus comparables" : "Por debajo de sus comparables";
}

export function numberOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export interface AnalystSummary {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  total: number;
}

export function summarizeAnalysts(r: Omit<AnalystSummary, "total"> | undefined): AnalystSummary | null {
  if (!r) return null;
  const total = r.strongBuy + r.buy + r.hold + r.sell + r.strongSell;
  return total > 0 ? { ...r, total } : null;
}
