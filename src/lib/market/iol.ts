import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { cached } from "./cache";
import { rangeStart, type Candle, type MarketProvider, type Quote, type Range, type SearchResult } from "./types";

const BASE = "https://api.invertironline.com";

// ---------- OAuth (password grant + refresh) ----------

const tokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
});

let token: { access: string; refresh: string; expires: number } | null = null;
let tokenPromise: Promise<string> | null = null;

async function requestToken(body: Record<string, string>) {
  const res = await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`IOL token ${res.status}`);
  const data = tokenSchema.parse(await res.json());
  token = {
    access: data.access_token,
    refresh: data.refresh_token,
    // margen de 60 s para no usar un token a punto de vencer
    expires: Date.now() + (data.expires_in - 60) * 1000,
  };
  return token.access;
}

async function getAccessToken(): Promise<string> {
  if (token && token.expires > Date.now()) return token.access;
  if (tokenPromise) return tokenPromise;

  tokenPromise = (async () => {
    if (token?.refresh) {
      try {
        return await requestToken({ grant_type: "refresh_token", refresh_token: token.refresh });
      } catch {
        token = null;
      }
    }
    if (!env.IOL_USERNAME || !env.IOL_PASSWORD) throw new Error("Faltan IOL_USERNAME / IOL_PASSWORD");
    return requestToken({ grant_type: "password", username: env.IOL_USERNAME, password: env.IOL_PASSWORD });
  })().finally(() => {
    tokenPromise = null;
  });

  return tokenPromise;
}

async function iolGet<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const doFetch = async () =>
    fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${await getAccessToken()}` },
      cache: "no-store",
    });

  let res = await doFetch();
  if (res.status === 401) {
    token = null;
    res = await doFetch();
  }
  if (!res.ok) throw new Error(`IOL ${path} → ${res.status}`);
  return schema.parse(await res.json());
}

// ---------- Esquemas (solo los campos que usamos; el resto se ignora) ----------

const num = z.number().nullish().transform((v) => v ?? null);

const quoteSchema = z.object({
  ultimoPrecio: z.number(),
  variacion: z.number().nullish(),
  apertura: num,
  maximo: num,
  minimo: num,
  cierreAnterior: num,
  volumenNominal: num,
  fechaHora: z.string().nullish(),
  moneda: z.union([z.string(), z.number()]).nullish(),
  descripcionTitulo: z.string().nullish(),
});

const historySchema = z.array(
  z.object({
    ultimoPrecio: z.number(),
    apertura: num,
    maximo: num,
    minimo: num,
    volumenNominal: num,
    fechaHora: z.string(),
  }),
);

const panelSchema = z.object({
  titulos: z.array(
    z.object({
      simbolo: z.string(),
      descripcion: z.string().nullish(),
      ultimoPrecio: z.number().nullish(),
      variacionPorcentual: z.number().nullish(),
      apertura: num,
      maximo: num,
      minimo: num,
      ultimoCierre: num,
      volumen: num,
      fecha: z.string().nullish(),
      moneda: z.union([z.string(), z.number()]).nullish(),
    }),
  ),
});

const portfolioSchema = z.object({
  activos: z.array(
    z.object({
      cantidad: z.number(),
      ultimoPrecio: z.number(),
      ppc: z.number().nullish(),
      variacionDiaria: z.number().nullish(),
      gananciaPorcentaje: z.number().nullish(),
      gananciaDinero: z.number().nullish(),
      valorizado: z.number(),
      titulo: z.object({
        simbolo: z.string(),
        descripcion: z.string().nullish(),
        tipo: z.string().nullish(),
        moneda: z.string().nullish(),
        mercado: z.string().nullish(),
      }),
    }),
  ),
});

const accountSchema = z.object({
  cuentas: z.array(
    z.object({
      tipo: z.string(),
      moneda: z.string(),
      disponible: z.number(),
      total: z.number(),
      titulosValorizados: z.number().nullish(),
    }),
  ),
  totalEnPesos: z.number().nullish(),
});

// ---------- Helpers ----------

function currencyOf(moneda: unknown): "ARS" | "USD" {
  const m = String(moneda ?? "").toLowerCase();
  return m.includes("dolar") || m === "2" ? "USD" : "ARS";
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** BCBA opera 10:30–17:00 ART; IOL entrega tiempo real a clientes con cuenta. */
function toQuote(symbol: string, q: z.infer<typeof quoteSchema>): Quote {
  const prevClose = q.cierreAnterior ?? null;
  const changePct = q.variacion ?? (prevClose ? ((q.ultimoPrecio - prevClose) / prevClose) * 100 : 0);
  const change = prevClose ? q.ultimoPrecio - prevClose : (q.ultimoPrecio * changePct) / (100 + changePct);
  return {
    symbol,
    market: "AR",
    name: q.descripcionTitulo ?? undefined,
    currency: currencyOf(q.moneda),
    price: q.ultimoPrecio,
    change,
    changePct,
    open: q.apertura,
    high: q.maximo,
    low: q.minimo,
    prevClose,
    volume: q.volumenNominal,
    source: "iol",
    timestamp: q.fechaHora ? new Date(q.fechaHora).toISOString() : new Date().toISOString(),
    delayed: false,
  };
}

// ---------- Provider ----------

export const iolProvider: MarketProvider = {
  source: "iol",

  quote(symbol) {
    const s = symbol.toUpperCase();
    return cached(`iol:q:${s}`, 5_000, async () =>
      toQuote(s, await iolGet(`/api/v2/bCBA/Titulos/${encodeURIComponent(s)}/Cotizacion`, quoteSchema)),
    );
  },

  history(symbol, range: Range) {
    const s = symbol.toUpperCase();
    // IOL solo entrega velas diarias: para 1D mostramos la última semana.
    const from = rangeStart(range === "1D" ? "1W" : range);
    const to = new Date();
    return cached(`iol:h:${s}:${range}`, 60_000, async () => {
      const rows = await iolGet(
        `/api/v2/bCBA/Titulos/${encodeURIComponent(s)}/Cotizacion/seriehistorica/${ymd(from)}/${ymd(to)}/ajustada`,
        historySchema,
      );
      const byDay = new Map<number, Candle>();
      for (const r of rows) {
        const day = new Date(r.fechaHora);
        day.setUTCHours(0, 0, 0, 0);
        const time = Math.floor(day.getTime() / 1000);
        if (byDay.has(time)) continue; // viene ordenado del más nuevo al más viejo
        byDay.set(time, {
          time,
          open: r.apertura ?? r.ultimoPrecio,
          high: r.maximo ?? r.ultimoPrecio,
          low: r.minimo ?? r.ultimoPrecio,
          close: r.ultimoPrecio,
          volume: r.volumenNominal ?? undefined,
        });
      }
      return [...byDay.values()].sort((a, b) => a.time - b.time);
    });
  },

  async search(query) {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    const universe = await getArUniverse();
    return universe
      .filter((r) => r.symbol.startsWith(q) || r.name.toUpperCase().includes(q))
      .slice(0, 15);
  },
};

// ---------- Paneles y portafolio ----------

export type ArPanel = "acciones" | "cedears" | "bonos";

const PANEL_PATH: Record<ArPanel, string> = {
  acciones: "/api/v2/Cotizaciones/acciones/Panel%20General/argentina",
  cedears: "/api/v2/Cotizaciones/cedears/todos/argentina",
  bonos: "/api/v2/Cotizaciones/titulosPublicos/todos/argentina",
};

export function getIolPanel(panel: ArPanel): Promise<Quote[]> {
  return cached(`iol:panel:${panel}`, 10_000, async () => {
    const data = await iolGet(PANEL_PATH[panel], panelSchema);
    return data.titulos
      .filter((t) => t.ultimoPrecio != null)
      .map((t) => {
        const price = t.ultimoPrecio as number;
        const changePct = t.variacionPorcentual ?? 0;
        const prevClose = t.ultimoCierre ?? price / (1 + changePct / 100);
        return {
          symbol: t.simbolo,
          market: "AR" as const,
          name: t.descripcion ?? undefined,
          currency: currencyOf(t.moneda),
          price,
          change: price - prevClose,
          changePct,
          open: t.apertura,
          high: t.maximo,
          low: t.minimo,
          prevClose,
          volume: t.volumen,
          source: "iol" as const,
          timestamp: t.fecha ? new Date(t.fecha).toISOString() : new Date().toISOString(),
          delayed: false,
        };
      });
  });
}

async function getArUniverse(): Promise<SearchResult[]> {
  return cached("iol:universe", 10 * 60_000, async () => {
    const panels = await Promise.allSettled([getIolPanel("acciones"), getIolPanel("cedears"), getIolPanel("bonos")]);
    const types = ["Acción", "CEDEAR", "Bono"];
    return panels.flatMap((p, i) =>
      p.status === "fulfilled"
        ? p.value.map((q) => ({ symbol: q.symbol, market: "AR" as const, name: q.name ?? q.symbol, type: types[i] }))
        : [],
    );
  });
}

export interface BrokerHolding {
  symbol: string;
  name: string;
  type: string;
  currency: "ARS" | "USD";
  quantity: number;
  avgPrice: number | null;
  lastPrice: number;
  dayChangePct: number | null;
  pnl: number | null;
  pnlPct: number | null;
  value: number;
}

export function getIolPortfolio(): Promise<BrokerHolding[]> {
  return cached("iol:portfolio", 15_000, async () => {
    const data = await iolGet("/api/v2/portafolio/argentina", portfolioSchema);
    return data.activos.map((a) => ({
      symbol: a.titulo.simbolo,
      name: a.titulo.descripcion ?? a.titulo.simbolo,
      type: a.titulo.tipo ?? "Otro",
      currency: currencyOf(a.titulo.moneda),
      quantity: a.cantidad,
      avgPrice: a.ppc ?? null,
      lastPrice: a.ultimoPrecio,
      dayChangePct: a.variacionDiaria ?? null,
      pnl: a.gananciaDinero ?? null,
      pnlPct: a.gananciaPorcentaje ?? null,
      value: a.valorizado,
    }));
  });
}

export interface BrokerCash {
  currency: "ARS" | "USD";
  available: number;
  total: number;
}

export function getIolCash(): Promise<BrokerCash[]> {
  return cached("iol:cash", 30_000, async () => {
    const data = await iolGet("/api/v2/estadocuenta", accountSchema);
    return data.cuentas
      .filter((c) => c.tipo.toLowerCase().includes("inversion"))
      .map((c) => ({ currency: currencyOf(c.moneda), available: c.disponible, total: c.total }));
  });
}
