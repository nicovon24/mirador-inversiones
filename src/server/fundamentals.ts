import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { hasFinnhub } from "@/lib/env";
import { isStale, planRefresh, type FundamentalsStatus } from "@/lib/fundamentals-policy";
import { finnhubMetrics, finnhubProfile, type FinnhubProfile } from "@/lib/market/finnhub";
import { numberOrNull } from "@/lib/research";

export interface FundamentalsRow {
  symbol: string;
  metrics: Record<string, number | null>;
  profile: FinnhubProfile | null;
  status: FundamentalsStatus;
  fetchedAt: Date;
  /** true si el dato superó su vigencia y todavía no se pudo actualizar. */
  stale: boolean;
}

/** Tope de descargas por pedido de página: el resto se completa en visitas siguientes o en el cron. */
export const DEFAULT_FETCH_BUDGET = 10;

function toRow(r: {
  symbol: string;
  metrics: Prisma.JsonValue;
  profile: Prisma.JsonValue | null;
  status: string;
  fetchedAt: Date;
}): FundamentalsRow {
  const raw = (r.metrics ?? {}) as Record<string, unknown>;
  return {
    symbol: r.symbol,
    metrics: Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, numberOrNull(v)])),
    profile: (r.profile as FinnhubProfile | null) ?? null,
    status: r.status as FundamentalsStatus,
    fetchedAt: r.fetchedAt,
    stale: isStale(r),
  };
}

/** Baja métricas y perfil de un ticker y los guarda, también cuando el proveedor no tiene datos o falla. */
async function download(symbol: string): Promise<FundamentalsRow> {
  let metrics: Record<string, number> = {};
  let profile: FinnhubProfile | null = null;
  let status: FundamentalsStatus = "ok";
  let error: string | null = null;
  try {
    const [m, p] = await Promise.all([finnhubMetrics(symbol), finnhubProfile(symbol).catch(() => null)]);
    // Solo se guardan los valores numéricos: el resto no se usa y engorda la fila.
    metrics = Object.fromEntries(
      Object.entries(m).filter((e): e is [string, number] => typeof e[1] === "number" && Number.isFinite(e[1])),
    );
    profile = p && Object.keys(p).length > 0 ? p : null;
    if (Object.keys(metrics).length === 0) status = "empty";
  } catch (e) {
    status = "error";
    error = (e as Error).message.slice(0, 500);
  }

  const fetchedAt = new Date();
  const data = {
    metrics,
    profile: (profile ?? undefined) as Prisma.InputJsonValue | undefined,
    status,
    error,
    fetchedAt,
  };
  const saved = await db.fundamentals.upsert({
    where: { symbol },
    create: { symbol, ...data },
    update: data,
  });
  return toRow(saved);
}

/**
 * Lee los fundamentals de varios tickers desde Postgres y baja del proveedor solo lo que falta o venció,
 * hasta `budget` descargas. Devuelve lo que haya, aunque esté vencido (marcado con `stale`).
 */
export async function getFundamentals(
  symbols: string[],
  { budget = DEFAULT_FETCH_BUDGET }: { budget?: number } = {},
): Promise<Map<string, FundamentalsRow>> {
  const unique = [...new Set(symbols.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const existing = await db.fundamentals.findMany({ where: { symbol: { in: unique } } });
  const rows = new Map(existing.map((r) => [r.symbol, toRow(r)]));

  if (hasFinnhub) {
    const toFetch = planRefresh(unique, rows, budget);
    // Secuencial a propósito: el limitador ya ordena las llamadas y así un pedido no acapara el cupo.
    for (const s of toFetch) {
      rows.set(s, await download(s));
    }
  }
  return rows;
}

export async function getFundamental(symbol: string, budget = 1): Promise<FundamentalsRow | null> {
  return (await getFundamentals([symbol], { budget })).get(symbol) ?? null;
}

/** Actualiza los tickers más viejos de la caché (para el cron). Devuelve cuántos actualizó. */
export async function refreshOldest(symbols: string[], budget: number): Promise<number> {
  const before = await db.fundamentals.findMany({ where: { symbol: { in: symbols } }, select: { symbol: true, status: true, fetchedAt: true } });
  const toFetch = planRefresh(symbols, new Map(before.map((r) => [r.symbol, r])), budget);
  for (const s of toFetch) await download(s);
  return toFetch.length;
}
