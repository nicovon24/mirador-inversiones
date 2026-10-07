import Decimal from "decimal.js";

type Num = number | string | Decimal | null | undefined;

const LOCALE = "es-AR";

function toNumber(value: Num): number | null {
  if (value === null || value === undefined) return null;
  const n = value instanceof Decimal ? value.toNumber() : Number(value);
  return Number.isFinite(n) ? n : null;
}

const numberCache = new Map<string, Intl.NumberFormat>();
function nf(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = JSON.stringify(options);
  let f = numberCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, options);
    numberCache.set(key, f);
  }
  return f;
}

/** 1.234,56 */
export function formatNumber(value: Num, decimals = 2): string {
  const n = toNumber(value);
  if (n === null) return "—";
  return nf({ minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
}

/** $ 1.234,56 · US$ 1.234,56 */
export function formatMoney(value: Num, currency: string = "ARS", decimals = 2): string {
  const n = toNumber(value);
  if (n === null) return "—";
  const prefix = currency === "USD" ? "US$" : "$";
  return `${prefix} ${formatNumber(n, decimals)}`;
}

/** +1,23 % (signo siempre visible para que el color no sea el único indicador). */
export function formatPercent(value: Num, decimals = 2): string {
  const n = toNumber(value);
  if (n === null) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${formatNumber(Math.abs(n), decimals)} %`;
}

/** +12,34 con signo. */
export function formatSigned(value: Num, decimals = 2): string {
  const n = toNumber(value);
  if (n === null) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${formatNumber(Math.abs(n), decimals)}`;
}

/** 61,2 M · 1,3 mil M */
export function formatCompact(value: Num): string {
  const n = toNumber(value);
  if (n === null) return "—";
  return nf({ notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatTime(date: Date | string | number): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(date));
}

export function formatDate(date: Date | string | number): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(date));
}

export function trend(value: Num): "up" | "down" | "flat" {
  const n = toNumber(value);
  if (n === null || n === 0) return "flat";
  return n > 0 ? "up" : "down";
}
