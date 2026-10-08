/** Utilidades para series de precios chicas (sparklines). Sin dependencias de servidor. */

/**
 * Reduce una serie a `n` puntos tomando muestras equiespaciadas y conservando siempre el primero y el último,
 * que son los que definen la variación del período.
 */
export function downsample(values: number[], n = 48): number[] {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length <= n || n < 2) return clean;
  const out: number[] = [];
  const step = (clean.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) out.push(clean[Math.round(i * step)]);
  return out;
}

/**
 * Variación porcentual entre el primer cierre del período y el último precio
 * (`lastPrice` si se conoce, si no el último cierre). null si no hay datos suficientes.
 */
export function periodChangePct(closes: number[], lastPrice?: number | null): number | null {
  const clean = closes.filter((v) => Number.isFinite(v));
  const first = clean[0];
  const last = lastPrice != null && Number.isFinite(lastPrice) ? lastPrice : clean.at(-1);
  if (first === undefined || last === undefined || first <= 0) return null;
  // Con un solo cierre hace falta el precio en vivo para tener dos puntos que comparar.
  if (clean.length < 2 && lastPrice == null) return null;
  return ((last - first) / first) * 100;
}

/** Rangos que ofrecen los selectores de período. Sin "1D": Argentina solo tiene velas diarias. */
export const PERIOD_RANGES = ["1W", "1M", "3M", "6M", "1Y", "ALL"] as const;
export type PeriodRange = (typeof PERIOD_RANGES)[number];
export const DEFAULT_PERIOD: PeriodRange = "1M";

export const PERIOD_LABEL: Record<PeriodRange, string> = {
  "1W": "1S",
  "1M": "1M",
  "3M": "3M",
  "6M": "6M",
  "1Y": "1A",
  ALL: "Todo",
};

export function parsePeriod(value: string | null | undefined): PeriodRange {
  return (PERIOD_RANGES as readonly string[]).includes(value ?? "") ? (value as PeriodRange) : DEFAULT_PERIOD;
}
