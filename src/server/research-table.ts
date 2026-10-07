import "server-only";
import { COMPANIES, findCompany } from "@/lib/companies";
import { hasFinnhub } from "@/lib/env";
import { parseKey } from "@/lib/market/types";
import {
  matchesQuery,
  paginate,
  sectorEs,
  sortRows,
  type ResearchRow,
  type RowType,
  type TableQuery,
} from "@/lib/research-table";
import { getFundamentals, refreshOldest, type FundamentalsRow } from "@/server/fundamentals";
import { getWatchlists } from "@/server/queries";
import { resolveFundamentalsAsync } from "@/server/research";

/** Descargas máximas por vista entre favoritos y página actual. */
const VIEW_FETCH_BUDGET = 10;

interface Base {
  key: string;
  symbol: string;
  name: string;
  type: RowType;
  sector: string | null;
  aliases: string[];
  fundamentalsSymbol: string;
}

/** Empresas del catálogo con datos fundamentales disponibles (acciones con ADR y CEDEARs). */
function catalogUniverse(): Base[] {
  return COMPANIES.filter((c) => c.adr && c.type !== "Bono").map((c) => ({
    key: `AR:${c.symbol}`,
    symbol: c.symbol,
    name: c.name,
    type: c.type === "CEDEAR" ? "CEDEAR" : "Acción",
    sector: c.sector ?? null,
    aliases: c.aliases ?? [],
    fundamentalsSymbol: c.adr!,
  }));
}

/** Favoritos de las watchlists que tienen fundamentals, en el orden de las listas y sin repetir. */
async function favoriteBases(): Promise<Base[]> {
  const lists = await getWatchlists();
  const seen = new Set<string>();
  const out: Base[] = [];
  for (const item of lists.flatMap((l) => l.items)) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    const parsed = parseKey(item.key);
    const target = parsed && (await resolveFundamentalsAsync(parsed.market, parsed.symbol));
    if (!parsed || !target) continue;
    const c = parsed.market === "AR" ? findCompany(parsed.symbol) : undefined;
    out.push({
      key: item.key,
      symbol: parsed.symbol,
      name: c?.name ?? item.name ?? parsed.symbol,
      type: parsed.market === "US" ? "EE.UU." : target.source === "cedear" ? "CEDEAR" : "Acción",
      sector: c?.sector ?? null,
      aliases: c?.aliases ?? [],
      fundamentalsSymbol: target.symbol,
    });
  }
  return out;
}

function toRow(b: Base, f: FundamentalsRow | undefined): ResearchRow {
  return {
    ...b,
    // El rubro del catálogo manda; si no hay, el de Finnhub traducido.
    sector: b.sector ?? sectorEs(f?.profile?.finnhubIndustry),
    // Si el catálogo no conoce la empresa, el nombre quedó igual al ticker: se usa el del proveedor.
    name: (b.type === "EE.UU." || b.name === b.symbol) && f?.profile?.name ? f.profile.name : b.name,
    metrics: f?.metrics ?? {},
    status: f ? f.status : "pending",
    fetchedAt: f?.fetchedAt.toISOString() ?? null,
    stale: f?.stale ?? false,
  };
}

export interface ResearchTableData {
  favorites: ResearchRow[];
  rows: ResearchRow[];
  page: number;
  pages: number;
  total: number;
  sectors: string[];
  /** Filas visibles que todavía esperan datos: se completan en próximas visitas o con el cron. */
  pending: number;
}

export async function getResearchTable(q: TableQuery): Promise<ResearchTableData> {
  const favBases = await favoriteBases();
  const favKeys = new Set(favBases.map((b) => b.key));
  const others = catalogUniverse().filter((b) => !favKeys.has(b.key));

  // 1) Leer toda la caché sin llamar al proveedor: el universo es chico y así se puede ordenar y filtrar completo.
  const all = [...favBases, ...others];
  const cached = await getFundamentals(
    all.map((b) => b.fundamentalsSymbol),
    { budget: 0 },
  );

  const allRows = others.map((b) => toRow(b, cached.get(b.fundamentalsSymbol)));
  const filtered = sortRows(
    allRows.filter((r) => matchesQuery(r, q)),
    q.orden,
    q.dir,
  );
  const page = paginate(filtered, q.pag);

  // 2) Completar solo lo que se ve (favoritos primero), con tope de descargas.
  const visible = [...favBases, ...page.items].map((b) => b.fundamentalsSymbol);
  const fresh = await getFundamentals(visible, { budget: VIEW_FETCH_BUDGET });
  const pick = (s: string) => fresh.get(s) ?? cached.get(s);

  const favorites = sortRows(
    favBases.map((b) => toRow(b, pick(b.fundamentalsSymbol))),
    q.orden,
    q.dir,
  );
  const rows = page.items.map((r) => toRow(r, pick(r.fundamentalsSymbol)));
  const sectors = [...new Set(allRows.map((r) => r.sector).filter((s): s is string => Boolean(s)))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );

  return {
    favorites,
    rows,
    page: page.page,
    pages: page.pages,
    total: page.total,
    sectors,
    pending: [...favorites, ...rows].filter((r) => r.status === "pending").length,
  };
}

/** Todos los tickers que la tabla puede mostrar (para el cron y el botón de actualizar). */
export async function researchUniverseSymbols(): Promise<{ favorites: string[]; all: string[] }> {
  const favs = (await favoriteBases()).map((b) => b.fundamentalsSymbol);
  const all = [...new Set([...favs, ...catalogUniverse().map((b) => b.fundamentalsSymbol)])];
  return { favorites: [...new Set(favs)], all };
}

/**
 * Baja lo que falta o venció del universo de la tabla: primero favoritos, después el resto del más viejo al más nuevo.
 * Cada empresa son 2 llamadas (métricas y perfil); con el limitador de 50/min, 20 empresas entran en menos de un minuto.
 */
export async function refreshResearchUniverse(budget: number): Promise<number> {
  if (!hasFinnhub) return 0;
  const { favorites, all } = await researchUniverseSymbols();
  const fromFavorites = await refreshOldest(favorites, budget);
  const fromRest = await refreshOldest(all, budget - fromFavorites);
  return fromFavorites + fromRest;
}
