/** Utilidades para series de precios chicas (sparklines). Sin dependencias de servidor. */

/**
 * Índices equiespaciados para reducir una serie de `length` puntos a `n`, conservando siempre el primero
 * y el último (los que definen la variación del período). Sirve para reducir fechas y precios por igual.
 */
export function sampleIndices(length: number, n = 48): number[] {
  if (length <= n || n < 2) return Array.from({ length }, (_, i) => i);
  const step = (length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => Math.round(i * step));
}

/** Reduce una serie a `n` puntos (descarta valores no finitos). */
export function downsample(values: number[], n = 48): number[] {
  const clean = values.filter((v) => Number.isFinite(v));
  return sampleIndices(clean.length, n).map((i) => clean[i]);
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
