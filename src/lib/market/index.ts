import "server-only";
import { findCompany, searchCompanies } from "@/lib/companies";
import { hasFinnhub, hasIol } from "@/lib/env";
import { cached } from "./cache";
import { data912Provider, getData912Panel, getData912Usa } from "./data912";
import { finnhubQuote, finnhubSearch } from "./finnhub";
import { impliedChangePct, impliedRate } from "./fx";
import { getIolPanel, iolProvider } from "./iol";
import { parseKey, type Candle, type MarketCode, type Quote, type Range, type SearchResult } from "./types";
import { yahooHistory, yahooQuote, yahooSearch } from "./yahoo";

export * from "./types";

/** Proveedor de Argentina: IOL si hay credenciales, data912 como respaldo gratuito. */
const ar = () => (hasIol ? iolProvider : data912Provider);

async function firstOk<T>(...loaders: Array<() => Promise<T>>): Promise<T> {
  let lastError: unknown;
  for (const load of loaders) {
    try {
      return await load();
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

async function usQuoteFromPanel(symbol: string): Promise<Quote> {
  const hit = (await getData912Usa()).find((q) => q.symbol === symbol);
  if (!hit) throw new Error(`${symbol} no está en el panel USA`);
  return hit;
}

export async function getQuote(market: MarketCode, symbol: string): Promise<Quote> {
  const s = symbol.toUpperCase();
  // Índices (^GSPC, ^MERV…) solo los tiene Yahoo.
  if (s.startsWith("^")) return yahooQuote(s, market);
  if (market === "AR") return firstOk(() => ar().quote(s), () => data912Provider.quote(s));
  return firstOk(
    ...(hasFinnhub ? [() => finnhubQuote(s)] : []),
    () => usQuoteFromPanel(s),
    () => yahooQuote(s, "US"),
  );
}

/** Varias cotizaciones a la vez; las que fallan se omiten (no rompen la tabla entera). */
export async function getQuotes(keys: string[]): Promise<Record<string, Quote>> {
  const unique = [...new Set(keys)].slice(0, 60);
  const settled = await Promise.allSettled(
    unique.map(async (key) => {
      const parsed = parseKey(key);
      if (!parsed) throw new Error(`clave inválida ${key}`);
      return [key, await getQuote(parsed.market, parsed.symbol)] as const;
    }),
  );
  const out: Record<string, Quote> = {};
  for (const r of settled) if (r.status === "fulfilled") out[r.value[0]] = r.value[1];
  return out;
}

/**
 * El histórico diario de data912 llega hasta la rueda anterior. Si hoy es día hábil,
 * se suma la vela del día armada con la cotización en vivo para que el gráfico no quede un día atrás.
 */
async function withTodayCandle(symbol: string, candles: Candle[]): Promise<Candle[]> {
  const last = candles.at(-1);
  if (!last) return candles;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const lastDay = new Date(last.time * 1000).toISOString().slice(0, 10);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  if (lastDay >= today || weekday === 0 || weekday === 6) return candles;

  const q = await getQuote("AR", symbol).catch(() => null);
  // Sin variación ni volumen: feriado o rueda sin operaciones, no se inventa una vela.
  if (!q || (q.change === 0 && !q.volume)) return candles;

  const open = q.open ?? q.prevClose ?? q.price;
  return [
    ...candles,
    {
      time: Math.floor(Date.parse(`${today}T00:00:00Z`) / 1000),
      open,
      high: Math.max(open, q.price, q.high ?? q.price),
      low: Math.min(open, q.price, q.low ?? q.price),
      close: q.price,
      volume: q.volume ?? undefined,
    },
  ];
}

export async function getHistory(market: MarketCode, symbol: string, range: Range): Promise<Candle[]> {
  const s = symbol.toUpperCase();
  if (market === "US" || s.startsWith("^")) return yahooHistory(s, range);
  // data912 no tiene muchos CEDEARs nuevos (NU, TSM, SNDK…): Yahoo los tiene en BYMA con sufijo .BA, en pesos.
  const yahooBa = async () => {
    const c = await yahooHistory(`${s}.BA`, range);
    if (c.length < 2) throw new Error(`Yahoo sin histórico para ${s}.BA`);
    return c;
  };
  const candles = await firstOk(
    ...(hasIol ? [() => iolProvider.history(s, range)] : []),
    () => data912Provider.history(s, range),
    yahooBa,
  );
  return withTodayCandle(s, candles);
}

export async function searchInstruments(query: string): Promise<SearchResult[]> {
  const [arRes, usRes] = await Promise.allSettled([
    ar().search(query),
    hasFinnhub ? finnhubSearch(query).catch(() => yahooSearch(query)) : yahooSearch(query),
  ]);
  const q = query.trim().toUpperCase();
  // El catálogo local suma nombres y alias ("galicia" → GGAL) que los proveedores no traen.
  const catalog = searchCompanies(query, 8);
  const named = new Map(catalog.map((r) => [r.symbol, r]));
  const arList = (arRes.status === "fulfilled" ? arRes.value : []).map((r) => {
    const c = findCompany(r.symbol);
    return c && r.name === r.symbol ? { ...r, name: c.name } : r;
  });
  const usList = usRes.status === "fulfilled" ? usRes.value : [];
  const merged = [...catalog, ...arList.filter((r) => !named.has(r.symbol)).slice(0, 8), ...usList.slice(0, 8)];
  // Coincidencia exacta de ticker primero; después el orden del catálogo y los proveedores.
  return merged.sort((a, b) => Number(b.symbol === q) - Number(a.symbol === q)).slice(0, 20);
}

export type Panel = "acciones" | "cedears" | "bonos" | "usa";

export function getPanel(panel: Panel): Promise<Quote[]> {
  if (panel === "usa") return getData912Usa();
  return firstOk(
    ...(hasIol ? [() => getIolPanel(panel)] : []),
    () => getData912Panel(panel),
  );
}

// ---------- Tarjetas del Overview ----------

export interface MarketCard {
  id: string;
  label: string;
  /** clave para navegar a la ficha, si existe */
  href?: string;
  quote: Quote | null;
  unit?: "pts" | "ARS" | "USD" | "bps";
}

export const INDEX_CARDS = [
  { id: "spx", label: "S&P 500", symbol: "^GSPC", market: "US" as const },
  { id: "ndx", label: "Nasdaq", symbol: "^IXIC", market: "US" as const },
  { id: "merval", label: "Merval", symbol: "^MERV", market: "AR" as const },
];

export async function getFx(kind: "MEP" | "CCL"): Promise<Quote> {
  return cached(`fx:${kind}`, 15_000, async () => {
    const usdTicker = kind === "MEP" ? "AL30D" : "AL30C";
    const [pesos, usd] = await Promise.all([getQuote("AR", "AL30"), getQuote("AR", usdTicker)]);
    const price = impliedRate(pesos.price, usd.price);
    if (price === null) throw new Error(`no se pudo calcular ${kind}`);
    const changePct = impliedChangePct(pesos.changePct, usd.changePct);
    const prevClose = price / (1 + changePct / 100);
    return {
      symbol: kind,
      market: "AR",
      name: kind === "MEP" ? "Dólar MEP (AL30)" : "Dólar CCL (AL30)",
      currency: "ARS",
      price,
      change: price - prevClose,
      changePct,
      open: null,
      high: null,
      low: null,
      prevClose,
      volume: null,
      source: pesos.source,
      timestamp: pesos.timestamp,
      delayed: pesos.delayed || usd.delayed,
    };
  });
}

async function getRiesgoPais(): Promise<Quote> {
  return cached("riesgo-pais", 10 * 60_000, async () => {
    const res = await fetch("https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais/ultimo", {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error("riesgo país no disponible");
    const data = (await res.json()) as { valor: number; fecha: string };
    return {
      symbol: "EMBI",
      market: "AR",
      name: "Riesgo país",
      currency: "ARS",
      price: data.valor,
      change: 0,
      changePct: 0,
      open: null,
      high: null,
      low: null,
      prevClose: null,
      volume: null,
      source: "argentinadatos",
      timestamp: new Date(`${data.fecha}T20:00:00Z`).toISOString(),
      delayed: true,
    };
  });
}

export async function getOverviewCards(): Promise<MarketCard[]> {
  const [indices, mep, ccl, rp] = await Promise.all([
    Promise.all(INDEX_CARDS.map((c) => getQuote(c.market, c.symbol).catch(() => null))),
    getFx("MEP").catch(() => null),
    getFx("CCL").catch(() => null),
    getRiesgoPais().catch(() => null),
  ]);
  return [
    ...INDEX_CARDS.map((c, i) => ({
      id: c.id,
      label: c.label,
      href: `/instrument/${c.market}/${encodeURIComponent(c.symbol)}`,
      quote: indices[i],
      unit: "pts" as const,
    })),
    { id: "mep", label: "Dólar MEP", quote: mep, unit: "ARS" as const },
    { id: "ccl", label: "Dólar CCL", quote: ccl, unit: "ARS" as const },
    { id: "rp", label: "Riesgo país", quote: rp, unit: "bps" as const },
  ];
}
