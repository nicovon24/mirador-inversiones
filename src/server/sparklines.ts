import "server-only";
import { getHistory, parseKey } from "@/lib/market";
import { downsample, periodChangePct, type PeriodRange } from "@/lib/series";

export interface SparkSeries {
  points: number[];
  changePct: number | null;
}

export const MAX_SPARK_KEYS = 60;
const CONCURRENCY = 6;

/**
 * Series chicas de precio por instrumento para sparklines y la variación del período.
 * Usa el histórico de data912/IOL (AR) y Yahoo (EE.UU.), que ya tiene caché de 10 minutos por símbolo:
 * no gasta cupo de Finnhub. Una clave que falla queda afuera sin romper las demás.
 */
export async function getSparkSeries(keys: string[], range: PeriodRange): Promise<Record<string, SparkSeries>> {
  const unique = [...new Set(keys)].slice(0, MAX_SPARK_KEYS);
  const out: Record<string, SparkSeries> = {};
  let next = 0;

  async function worker() {
    while (next < unique.length) {
      const key = unique[next++];
      const parsed = parseKey(key);
      if (!parsed) continue;
      try {
        const closes = (await getHistory(parsed.market, parsed.symbol, range)).map((c) => c.close);
        if (closes.length >= 2) out[key] = { points: downsample(closes), changePct: periodChangePct(closes) };
      } catch {
        // Sin histórico para este instrumento: la fila muestra "—".
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, unique.length) }, worker));
  return out;
}
