import "server-only";
import { findCompany, sectorPeerAdrs } from "@/lib/companies";
import { hasFinnhub } from "@/lib/env";
import {
  finnhubEarnings,
  finnhubPeers,
  finnhubRecommendations,
  type FinnhubEarning,
  type FinnhubProfile,
} from "@/lib/market/finnhub";
import { median, PEER_METRICS, summarizeAnalysts, type AnalystSummary } from "@/lib/research";
import { getFundamental, getFundamentals } from "@/server/fundamentals";

export type ResearchSource =
  /** Acción de EE.UU.: datos directos. */
  | "direct"
  /** CEDEAR: datos de la acción original en EE.UU. */
  | "cedear"
  /** Acción argentina: datos de su ADR en Nueva York. */
  | "adr";

export interface PeerRow {
  symbol: string;
  name?: string;
  values: Record<string, number | null>;
}

export interface Research {
  /** Ticker con el que se consultó Finnhub. */
  fundamentalsSymbol: string;
  source: ResearchSource;
  profile: FinnhubProfile | null;
  metrics: Record<string, number | null>;
  peers: PeerRow[];
  peerMedians: Record<string, number | null>;
  analysts: AnalystSummary | null;
  earnings: FinnhubEarning[];
  /** Cuándo se bajaron los datos fundamentales (ISO). */
  fetchedAt: string;
  stale: boolean;
}

export type ResearchResult =
  | { ok: true; data: Research }
  | { ok: false; reason: "no-key" | "unsupported" | "no-data"; message: string };

/** A qué ticker de EE.UU. hay que preguntarle los fundamentals de un instrumento. */
export function resolveFundamentals(market: "AR" | "US", symbol: string): { symbol: string; source: ResearchSource } | null {
  if (symbol.startsWith("^")) return null;
  if (market === "US") return { symbol, source: "direct" };
  const c = findCompany(symbol);
  if (!c?.adr) return null;
  return { symbol: c.adr, source: c.type === "CEDEAR" ? "cedear" : "adr" };
}

const MAX_PEERS = 5;

export async function getResearch(market: "AR" | "US", symbol: string): Promise<ResearchResult> {
  if (!hasFinnhub)
    return { ok: false, reason: "no-key", message: "Falta configurar FINNHUB_API_KEY para ver datos fundamentales." };

  const target = resolveFundamentals(market, symbol);
  if (!target) {
    const c = market === "AR" ? findCompany(symbol) : undefined;
    return {
      ok: false,
      reason: "unsupported",
      message:
        c?.type === "Bono"
          ? "Los bonos no tienen balances de empresa: mirá su TIR, paridad y duration en la ficha del instrumento."
          : "No hay datos fundamentales gratuitos para este instrumento. Solo están disponibles las acciones de EE.UU., los CEDEARs y las empresas argentinas que también cotizan en Nueva York.",
    };
  }

  const [main, recs, earnings, peerList] = await Promise.all([
    getFundamental(target.symbol),
    finnhubRecommendations(target.symbol).catch(() => []),
    finnhubEarnings(target.symbol).catch(() => []),
    finnhubPeers(target.symbol).catch(() => [] as string[]),
  ]);

  if (!main || main.status !== "ok")
    return { ok: false, reason: "no-data", message: `Finnhub no devolvió datos fundamentales para ${target.symbol}.` };

  // Comparables: Finnhub incluye al propio ticker en la lista; se descarta y se limita para cuidar el cupo de la API.
  // Finnhub no trae comparables para los ADR argentinos: se usan las empresas del mismo sector del catálogo.
  const fromProvider = peerList.filter((s) => s !== target.symbol && !s.includes("."));
  const peerSymbols = (fromProvider.length > 0 ? fromProvider : market === "AR" ? sectorPeerAdrs(symbol) : []).slice(0, MAX_PEERS);
  const peerRows = await getFundamentals(peerSymbols, { budget: MAX_PEERS });
  const peers: PeerRow[] = peerSymbols.flatMap((s) => {
    const r = peerRows.get(s);
    if (!r || r.status !== "ok") return [];
    return [{ symbol: s, name: r.profile?.name, values: Object.fromEntries(PEER_METRICS.map((d) => [d.key, r.metrics[d.key] ?? null])) }];
  });
  const peerMedians = Object.fromEntries(
    PEER_METRICS.map((d) => [d.key, median(peers.map((p) => p.values[d.key]).filter((v): v is number => v !== null))]),
  );
  const metrics = main.metrics;
  const profile = main.profile;

  return {
    ok: true,
    data: {
      fundamentalsSymbol: target.symbol,
      source: target.source,
      profile,
      metrics,
      peers,
      peerMedians,
      analysts: summarizeAnalysts(recs[0]),
      earnings: earnings.slice(0, 4),
      fetchedAt: main.fetchedAt.toISOString(),
      stale: main.stale,
    },
  };
}
