export type MarketCode = "AR" | "US";

export type QuoteSource = "iol" | "finnhub" | "yahoo" | "data912" | "argentinadatos";

export type Range = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL";
export const RANGES: Range[] = ["1D", "1W", "1M", "3M", "6M", "1Y", "ALL"];

export interface Quote {
  symbol: string;
  market: MarketCode;
  name?: string;
  currency: "ARS" | "USD";
  price: number;
  change: number;
  changePct: number;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  volume: number | null;
  /** Mejor punta compradora / vendedora, si el proveedor la entrega. */
  bid?: number | null;
  ask?: number | null;
  source: QuoteSource;
  /** ISO del dato según el proveedor. */
  timestamp: string;
  /** true si el proveedor entrega el dato con demora (p. ej. 20 min). */
  delayed: boolean;
}

export interface Candle {
  /** Unix en segundos (formato que usa lightweight-charts). */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface SearchResult {
  symbol: string;
  market: MarketCode;
  name: string;
  type?: string;
}

export interface MarketProvider {
  readonly source: QuoteSource;
  quote(symbol: string): Promise<Quote>;
  history(symbol: string, range: Range): Promise<Candle[]>;
  search(query: string): Promise<SearchResult[]>;
}

/** "AR:GGAL", "US:AAPL" — clave única de instrumento en toda la app. */
export type InstrumentKey = `${MarketCode}:${string}`;

export function toKey(market: MarketCode, symbol: string): InstrumentKey {
  return `${market}:${symbol.toUpperCase()}`;
}

export function parseKey(key: string): { market: MarketCode; symbol: string } | null {
  const [market, symbol] = key.split(":");
  if ((market !== "AR" && market !== "US") || !symbol) return null;
  return { market, symbol: symbol.toUpperCase() };
}

export function rangeStart(range: Range, now = new Date()): Date {
  const d = new Date(now);
  switch (range) {
    case "1D":
      d.setDate(d.getDate() - 1);
      break;
    case "1W":
      d.setDate(d.getDate() - 7);
      break;
    case "1M":
      d.setMonth(d.getMonth() - 1);
      break;
    case "3M":
      d.setMonth(d.getMonth() - 3);
      break;
    case "6M":
      d.setMonth(d.getMonth() - 6);
      break;
    case "1Y":
      d.setFullYear(d.getFullYear() - 1);
      break;
    case "ALL":
      d.setFullYear(d.getFullYear() - 10);
      break;
  }
  return d;
}
