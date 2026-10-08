"use client";

import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import type { Candle, Quote, Range, SearchResult } from "@/lib/market/types";
import type { MarketCard, Panel } from "@/lib/market";

/** Intervalo de polling de cotizaciones (RF tiempo real). */
export const POLL_MS = 5_000;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok && res.status !== 502) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function useQuotes(keys: string[]) {
  const sorted = [...new Set(keys)].sort();
  return useQuery({
    queryKey: ["quotes", sorted],
    queryFn: () =>
      getJson<{ quotes: Record<string, Quote>; fetchedAt: string }>(
        `/api/quotes?keys=${encodeURIComponent(sorted.join(","))}`,
      ),
    enabled: sorted.length > 0,
    refetchInterval: POLL_MS,
    placeholderData: keepPreviousData,
  });
}

export function useHistory(key: string | null, range: Range) {
  return useQuery({
    queryKey: ["history", key, range],
    queryFn: () =>
      getJson<{ candles: Candle[]; error?: string }>(
        `/api/history?key=${encodeURIComponent(key!)}&range=${range}`,
      ),
    enabled: Boolean(key),
    refetchInterval: range === "1D" ? 60_000 : false,
    placeholderData: keepPreviousData,
  });
}

export function useOverviewCards(initial?: MarketCard[]) {
  return useQuery({
    queryKey: ["overview"],
    queryFn: () => getJson<{ cards: MarketCard[]; fetchedAt: string }>("/api/overview"),
    refetchInterval: 15_000,
    initialData: initial ? { cards: initial, fetchedAt: new Date().toISOString() } : undefined,
  });
}

export function usePanel(panel: Panel) {
  return useQuery({
    queryKey: ["panel", panel],
    queryFn: () => getJson<{ quotes: Quote[]; fetchedAt: string; error?: string }>(`/api/panel?panel=${panel}`),
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
  });
}

export function useSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ["search", q.toLowerCase()],
    queryFn: () => getJson<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 1,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export interface SparkSeriesView {
  points: number[];
  times: number[];
  changePct: number | null;
}

/** Sparklines de varias filas en un solo pedido. Los históricos cambian poco: se reusan 5 minutos. */
export function useSparklines(keys: string[], range: string) {
  const sorted = [...new Set(keys)].sort();
  return useQuery({
    queryKey: ["sparklines", range, sorted],
    queryFn: () =>
      getJson<{ series: Record<string, SparkSeriesView> }>(
        `/api/sparklines?range=${range}&keys=${encodeURIComponent(sorted.join(","))}`,
      ),
    enabled: sorted.length > 0,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Igual que useSparklines pero para listas largas: parte las claves en tramos de 50 (una request por tramo,
 * en el orden en que se muestran) y junta los resultados. "Mostrar más" solo pide el tramo nuevo.
 */
export function useSparklineChunks(keys: string[], range: string, chunk = 50) {
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += chunk) chunks.push([...new Set(keys.slice(i, i + chunk))].sort());
  const results = useQueries({
    queries: chunks.map((c) => ({
      queryKey: ["sparklines", range, c],
      queryFn: () =>
        getJson<{ series: Record<string, SparkSeriesView> }>(`/api/sparklines?range=${range}&keys=${encodeURIComponent(c.join(","))}`),
      staleTime: 5 * 60_000,
      placeholderData: keepPreviousData,
    })),
  });
  const series: Record<string, SparkSeriesView> = {};
  for (const r of results) Object.assign(series, r.data?.series);
  return { series, isLoading: results.some((r) => r.isLoading) };
}
