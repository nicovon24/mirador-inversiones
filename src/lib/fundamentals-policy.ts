/** Reglas de vigencia de la caché de datos fundamentales. Sin dependencias de servidor. */

const HOUR = 3_600_000;

/** Los balances cambian por trimestre: un día de vigencia sobra. */
export const FRESH_FOR_MS = 24 * HOUR;
/** Si el proveedor no tiene datos o falló, se reintenta antes. */
export const RETRY_EMPTY_MS = 6 * HOUR;
export const RETRY_ERROR_MS = 1 * HOUR;

export type FundamentalsStatus = "ok" | "empty" | "error";

export interface CachedEntry {
  status: string;
  fetchedAt: Date;
}

export function maxAgeFor(status: string): number {
  if (status === "error") return RETRY_ERROR_MS;
  if (status === "empty") return RETRY_EMPTY_MS;
  return FRESH_FOR_MS;
}

export function isStale(entry: CachedEntry | undefined, now = new Date()): boolean {
  if (!entry) return true;
  return now.getTime() - entry.fetchedAt.getTime() >= maxAgeFor(entry.status);
}

/**
 * Qué símbolos hay que bajar del proveedor, respetando un tope por pedido.
 * Primero los que no existen en la caché (la página no puede mostrarlos) y después los vencidos,
 * del más viejo al más nuevo. Los vencidos que no entran se siguen mostrando con su fecha.
 */
export function planRefresh(
  symbols: string[],
  cache: Map<string, CachedEntry>,
  budget: number,
  now = new Date(),
): string[] {
  const unique = [...new Set(symbols)];
  const missing = unique.filter((s) => !cache.has(s));
  const stale = unique
    .filter((s) => cache.has(s) && isStale(cache.get(s), now))
    .sort((a, b) => cache.get(a)!.fetchedAt.getTime() - cache.get(b)!.fetchedAt.getTime());
  return [...missing, ...stale].slice(0, Math.max(0, budget));
}
