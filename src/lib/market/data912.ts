import "server-only";
import { z } from "zod";
import { cached } from "./cache";
import { rangeStart, type Candle, type MarketProvider, type Quote, type Range, type SearchResult } from "./types";

/**
 * data912.com: API gratuita sin clave con paneles de BYMA y velas diarias.
 * Respaldo para Argentina cuando no hay credenciales de IOL.
 */
const BASE = "https://data912.com";

const liveSchema = z.array(
  z.object({
    symbol: z.string(),
    c: z.number().nullish(),
    pct_change: z.number().nullish(),
    v: z.number().nullish(),
    px_bid: z.number().nullish(),
    px_ask: z.number().nullish(),
  }),
);

const historySchema = z.array(
  z.object({ date: z.string(), o: z.number(), h: z.number(), l: z.number(), c: z.number(), v: z.number().nullish() }),
);

export type ArPanel = "acciones" | "cedears" | "bonos";
const LIVE_PATH: Record<ArPanel, string> = {
  acciones: "/live/arg_stocks",
  cedears: "/live/arg_cedears",
  bonos: "/live/arg_bonds",
};
const HIST_PATH: Record<ArPanel, string> = {
  acciones: "/historical/stocks",
  cedears: "/historical/cedears",
  bonos: "/historical/bonds",
};
const TYPE_LABEL: Record<ArPanel, string> = { acciones: "Acción", cedears: "CEDEAR", bonos: "Bono" };

async function get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`data912 ${path} → ${res.status}`);
  return schema.parse(await res.json());
}

/** Los tickers terminados en D (dólar MEP) o C (cable) cotizan en USD. */
function currencyOfTicker(symbol: string, panel: ArPanel): "ARS" | "USD" {
  if (panel === "acciones") return "ARS";
  return /[DC]$/.test(symbol) && symbol.length > 3 ? "USD" : "ARS";
}

export function getData912Panel(panel: ArPanel): Promise<Quote[]> {
  return cached(`d912:panel:${panel}`, 15_000, async () => {
    const rows = await get(LIVE_PATH[panel], liveSchema);
    const now = new Date().toISOString();
    return rows
      .filter((r) => r.c != null && r.c > 0)
      .map((r) => {
        const price = r.c as number;
        const changePct = r.pct_change ?? 0;
        const prevClose = price / (1 + changePct / 100);
        return {
          symbol: r.symbol,
          market: "AR" as const,
          currency: currencyOfTicker(r.symbol, panel),
          price,
          change: price - prevClose,
          changePct,
          open: null,
          high: null,
          low: null,
          prevClose,
          volume: r.v ?? null,
          bid: r.px_bid ?? null,
          ask: r.px_ask ?? null,
          source: "data912" as const,
          timestamp: now,
          delayed: true,
        };
      });
  });
}

/** Panel de acciones de EE.UU. en una sola llamada (ideal para tablas grandes). */
export function getData912Usa(): Promise<Quote[]> {
  return cached("d912:usa", 15_000, async () => {
    const rows = await get("/live/usa_stocks", liveSchema);
    const now = new Date().toISOString();
    return rows
      .filter((r) => r.c != null && r.c > 0)
      .map((r) => {
        const price = r.c as number;
        const changePct = r.pct_change ?? 0;
        const prevClose = price / (1 + changePct / 100);
        return {
          symbol: r.symbol,
          market: "US" as const,
          currency: "USD" as const,
          price,
          change: price - prevClose,
          changePct,
          open: null,
          high: null,
          low: null,
          prevClose,
          volume: r.v ?? null,
          bid: r.px_bid ?? null,
          ask: r.px_ask ?? null,
          source: "data912" as const,
          timestamp: now,
          delayed: true,
        };
      });
  });
}

async function findPanel(symbol: string): Promise<{ panel: ArPanel; quote: Quote } | null> {
  for (const panel of ["acciones", "cedears", "bonos"] as const) {
    const rows = await getData912Panel(panel);
    const quote = rows.find((r) => r.symbol === symbol);
    if (quote) return { panel, quote };
  }
  return null;
}

export const data912Provider: MarketProvider = {
  source: "data912",

  async quote(symbol) {
    const s = symbol.toUpperCase();
    const hit = await findPanel(s);
    if (!hit) throw new Error(`data912: ${s} no encontrado`);
    return hit.quote;
  },

  async history(symbol, range: Range) {
    const s = symbol.toUpperCase();
    const hit = await findPanel(s);
    const panel = hit?.panel ?? "acciones";
    const all = await cached(`d912:h:${panel}:${s}`, 10 * 60_000, () =>
      get(`${HIST_PATH[panel]}/${encodeURIComponent(s)}`, historySchema),
    );
    const from = rangeStart(range === "1D" ? "1W" : range).getTime() / 1000;
    return all
      .map<Candle>((r) => ({
        time: Math.floor(Date.parse(`${r.date}T00:00:00Z`) / 1000),
        open: r.o,
        high: r.h,
        low: r.l,
        close: r.c,
        volume: r.v ?? undefined,
      }))
      .filter((c) => c.time >= from);
  },

  async search(query) {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    const out: SearchResult[] = [];
    for (const panel of ["acciones", "cedears", "bonos"] as const) {
      const rows = await getData912Panel(panel).catch(() => []);
      for (const r of rows) {
        if (r.symbol.startsWith(q)) out.push({ symbol: r.symbol, market: "AR", name: r.symbol, type: TYPE_LABEL[panel] });
      }
    }
    return out.sort((a, b) => a.symbol.length - b.symbol.length).slice(0, 15);
  },
};
