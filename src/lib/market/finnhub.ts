import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { TokenBucket } from "@/lib/rate-limit";
import { cached } from "./cache";
import type { Quote, SearchResult } from "./types";

/** Finnhub free: 60 req/min, cotización en tiempo real de EE.UU. */
const BASE = "https://finnhub.io/api/v1";

const quoteSchema = z.object({
  c: z.number(),
  d: z.number().nullable(),
  dp: z.number().nullable(),
  h: z.number().nullable(),
  l: z.number().nullable(),
  o: z.number().nullable(),
  pc: z.number().nullable(),
  t: z.number(),
});

const searchSchema = z.object({
  result: z.array(z.object({ symbol: z.string(), description: z.string(), type: z.string().nullish() })),
});

const profileSchema = z.object({ name: z.string().optional() }).passthrough();

const metricSchema = z.object({ metric: z.record(z.string(), z.unknown()) });

/** Un solo cupo para todas las llamadas a Finnhub, con margen bajo el límite de 60 por minuto. */
export const finnhubLimiter = new TokenBucket(50, 60_000);

async function get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  await finnhubLimiter.take();
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${BASE}${path}${sep}token=${env.FINNHUB_API_KEY}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`finnhub ${path.split("?")[0]} → ${res.status}`);
  return schema.parse(await res.json());
}

export function finnhubQuote(symbol: string): Promise<Quote> {
  const s = symbol.toUpperCase();
  return cached(`fh:q:${s}`, 5_000, async () => {
    const q = await get(`/quote?symbol=${encodeURIComponent(s)}`, quoteSchema);
    if (!q.c) throw new Error(`finnhub: ${s} sin cotización`);
    return {
      symbol: s,
      market: "US",
      currency: "USD",
      price: q.c,
      change: q.d ?? 0,
      changePct: q.dp ?? 0,
      open: q.o,
      high: q.h,
      low: q.l,
      prevClose: q.pc,
      volume: null,
      source: "finnhub",
      timestamp: new Date(q.t * 1000).toISOString(),
      delayed: false,
    };
  });
}

export function finnhubSearch(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return Promise.resolve([]);
  return cached(`fh:s:${q.toLowerCase()}`, 10 * 60_000, async () => {
    const data = await get(`/search?q=${encodeURIComponent(q)}&exchange=US`, searchSchema);
    return data.result
      .filter((r) => !r.symbol.includes("."))
      .slice(0, 10)
      .map((r) => ({ symbol: r.symbol, market: "US" as const, name: r.description, type: r.type ?? undefined }));
  });
}

export function finnhubProfileName(symbol: string): Promise<string | undefined> {
  return cached(`fh:p:${symbol}`, 24 * 3_600_000, async () => {
    const p = await get(`/stock/profile2?symbol=${encodeURIComponent(symbol)}`, profileSchema);
    return p.name;
  });
}

/** Ratios básicos (P/E, beta, máximos de 52 semanas…) para la ficha del instrumento. */
export function finnhubMetrics(symbol: string): Promise<Record<string, unknown>> {
  return cached(`fh:m:${symbol}`, 6 * 3_600_000, async () => {
    const m = await get(`/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all`, metricSchema);
    return m.metric;
  });
}

const fullProfileSchema = z
  .object({
    name: z.string().optional(),
    country: z.string().optional(),
    currency: z.string().optional(),
    exchange: z.string().optional(),
    finnhubIndustry: z.string().optional(),
    ipo: z.string().optional(),
    weburl: z.string().optional(),
    logo: z.string().optional(),
    marketCapitalization: z.number().optional(),
  })
  .passthrough();

export type FinnhubProfile = z.infer<typeof fullProfileSchema>;

export function finnhubProfile(symbol: string): Promise<FinnhubProfile> {
  return cached(`fh:pf:${symbol}`, 24 * 3_600_000, () =>
    get(`/stock/profile2?symbol=${encodeURIComponent(symbol)}`, fullProfileSchema),
  );
}

const recommendationSchema = z.array(
  z.object({
    period: z.string(),
    strongBuy: z.number(),
    buy: z.number(),
    hold: z.number(),
    sell: z.number(),
    strongSell: z.number(),
  }),
);

export type FinnhubRecommendation = z.infer<typeof recommendationSchema>[number];

/** Consenso de analistas por mes, el más reciente primero. */
export function finnhubRecommendations(symbol: string): Promise<FinnhubRecommendation[]> {
  return cached(`fh:rec:${symbol}`, 12 * 3_600_000, () =>
    get(`/stock/recommendation?symbol=${encodeURIComponent(symbol)}`, recommendationSchema),
  );
}

const earningsSchema = z.array(
  z.object({
    period: z.string(),
    actual: z.number().nullable(),
    estimate: z.number().nullable(),
    surprisePercent: z.number().nullable(),
    quarter: z.number(),
    year: z.number(),
  }),
);

export type FinnhubEarning = z.infer<typeof earningsSchema>[number];

/** Últimos resultados trimestrales contra lo que estimaban los analistas. */
export function finnhubEarnings(symbol: string): Promise<FinnhubEarning[]> {
  return cached(`fh:earn:${symbol}`, 12 * 3_600_000, () =>
    get(`/stock/earnings?symbol=${encodeURIComponent(symbol)}`, earningsSchema),
  );
}

/** Empresas comparables del mismo rubro según Finnhub (incluye al propio ticker). */
export function finnhubPeers(symbol: string): Promise<string[]> {
  return cached(`fh:peers:${symbol}`, 24 * 3_600_000, () =>
    get(`/stock/peers?symbol=${encodeURIComponent(symbol)}`, z.array(z.string())),
  );
}
