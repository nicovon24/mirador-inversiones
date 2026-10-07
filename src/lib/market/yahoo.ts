import "server-only";
import { z } from "zod";
import { cached } from "./cache";
import type { Candle, MarketCode, Quote, Range, SearchResult } from "./types";

/**
 * Endpoints públicos de Yahoo Finance (sin clave). Se usan para índices
 * (^GSPC, ^IXIC, ^DJI, ^MERV) y para velas de EE.UU., que Finnhub ya no
 * ofrece en el plan gratis.
 */
const BASE = "https://query1.finance.yahoo.com";
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; Mirador/1.0)" };

const chartSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          meta: z.object({
            symbol: z.string(),
            currency: z.string().nullish(),
            regularMarketPrice: z.number(),
            chartPreviousClose: z.number().nullish(),
            previousClose: z.number().nullish(),
            regularMarketDayHigh: z.number().nullish(),
            regularMarketDayLow: z.number().nullish(),
            regularMarketVolume: z.number().nullish(),
            regularMarketTime: z.number().nullish(),
            longName: z.string().nullish(),
            shortName: z.string().nullish(),
          }),
          timestamp: z.array(z.number()).nullish(),
          indicators: z.object({
            quote: z.array(
              z.object({
                open: z.array(z.number().nullable()).nullish(),
                high: z.array(z.number().nullable()).nullish(),
                low: z.array(z.number().nullable()).nullish(),
                close: z.array(z.number().nullable()).nullish(),
                volume: z.array(z.number().nullable()).nullish(),
              }),
            ),
          }),
        }),
      )
      .nullable(),
  }),
});

const searchSchema = z.object({
  quotes: z.array(
    z.object({
      symbol: z.string(),
      shortname: z.string().nullish(),
      longname: z.string().nullish(),
      quoteType: z.string().nullish(),
      exchange: z.string().nullish(),
    }),
  ),
});

const RANGE_PARAMS: Record<Range, { range: string; interval: string }> = {
  "1D": { range: "1d", interval: "5m" },
  "1W": { range: "5d", interval: "30m" },
  "1M": { range: "1mo", interval: "1d" },
  "3M": { range: "3mo", interval: "1d" },
  "6M": { range: "6mo", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
  ALL: { range: "10y", interval: "1wk" },
};

async function chart(symbol: string, range: Range) {
  const { range: r, interval } = RANGE_PARAMS[range];
  const url = `${BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${r}&interval=${interval}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`yahoo chart ${symbol} → ${res.status}`);
  const data = chartSchema.parse(await res.json());
  const result = data.chart.result?.[0];
  if (!result) throw new Error(`yahoo chart ${symbol}: sin datos`);
  return result;
}

export function yahooQuote(symbol: string, market: MarketCode = "US", display = symbol): Promise<Quote> {
  return cached(`yh:q:${symbol}`, 15_000, async () => {
    const { meta } = await chart(symbol, "1D");
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
    const price = meta.regularMarketPrice;
    const change = prevClose ? price - prevClose : 0;
    return {
      symbol: display,
      market,
      name: meta.longName ?? meta.shortName ?? undefined,
      currency: meta.currency === "ARS" ? "ARS" : "USD",
      price,
      change,
      changePct: prevClose ? (change / prevClose) * 100 : 0,
      open: null,
      high: meta.regularMarketDayHigh ?? null,
      low: meta.regularMarketDayLow ?? null,
      prevClose,
      volume: meta.regularMarketVolume ?? null,
      source: "yahoo",
      timestamp: new Date((meta.regularMarketTime ?? Date.now() / 1000) * 1000).toISOString(),
      // Yahoo entrega tiempo real para NYSE/NASDAQ, pero sin garantía contractual.
      delayed: true,
    };
  });
}

export function yahooHistory(symbol: string, range: Range): Promise<Candle[]> {
  const ttl = range === "1D" ? 30_000 : range === "1W" ? 120_000 : 10 * 60_000;
  return cached(`yh:h:${symbol}:${range}`, ttl, async () => {
    const result = await chart(symbol, range);
    const ts = result.timestamp ?? [];
    const q = result.indicators.quote[0] ?? {};
    const candles: Candle[] = [];
    ts.forEach((time, i) => {
      const close = q.close?.[i];
      if (close == null) return;
      candles.push({
        time,
        open: q.open?.[i] ?? close,
        high: q.high?.[i] ?? close,
        low: q.low?.[i] ?? close,
        close,
        volume: q.volume?.[i] ?? undefined,
      });
    });
    return candles;
  });
}

export function yahooSearch(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return Promise.resolve([]);
  return cached(`yh:s:${q.toLowerCase()}`, 10 * 60_000, async () => {
    const url = `${BASE}/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`;
    const res = await fetch(url, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return [];
    const data = searchSchema.parse(await res.json());
    return data.quotes
      .filter((r) => (r.quoteType === "EQUITY" || r.quoteType === "ETF") && !r.symbol.includes("."))
      .map((r) => ({
        symbol: r.symbol,
        market: "US" as const,
        name: r.longname ?? r.shortname ?? r.symbol,
        type: r.quoteType === "ETF" ? "ETF" : "Acción",
      }));
  });
}
