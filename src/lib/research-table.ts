/** Tabla comparativa de Investigación: filas, columnas, filtro, orden y paginado. Sin dependencias de servidor. */
import { matchScore, normalizeText } from "@/lib/companies";
import { RESEARCH_GROUPS, type MetricDef } from "@/lib/research";

export type RowType = "Acción" | "CEDEAR" | "EE.UU.";
export type RowStatus = "ok" | "empty" | "error" | "pending";

export interface ResearchRow {
  /** Clave del instrumento en la app (AR:GGAL, US:MSFT). */
  key: string;
  symbol: string;
  name: string;
  type: RowType;
  sector: string | null;
  aliases: string[];
  /** Ticker con el que se consultan los fundamentals (GGAL, YPF, AAPL…). */
  fundamentalsSymbol: string;
  metrics: Record<string, number | null>;
  /** "pending": todavía no se bajaron los datos. */
  status: RowStatus;
  fetchedAt: string | null;
  stale: boolean;
}

const ALL_METRICS = RESEARCH_GROUPS.flatMap((g) => g.metrics);
const byKey = (k: string) => ALL_METRICS.find((m) => m.key === k)!;

/** Columnas de la tabla: lo justo para comparar valuación, rentabilidad, crecimiento, deuda y dividendos de un vistazo. */
export const TABLE_COLUMNS: (MetricDef & { short: string })[] = [
  { ...byKey("peTTM"), short: "PER" },
  { ...byKey("pbAnnual"), short: "P/VL" },
  { ...byKey("evEbitdaTTM"), short: "EV/EBITDA" },
  { ...byKey("roeTTM"), short: "ROE" },
  { ...byKey("netProfitMarginTTM"), short: "Margen neto" },
  { ...byKey("revenueGrowthTTMYoy"), short: "Ventas 12 m" },
  { ...byKey("totalDebt/totalEquityQuarterly"), short: "Deuda/Pat." },
  { ...byKey("currentDividendYieldTTM"), short: "Dividendo" },
  { ...byKey("beta"), short: "Beta" },
];

export const SORTABLE = new Set(["name", ...TABLE_COLUMNS.map((c) => c.key)]);
export const PAGE_SIZE = 25;
export const TYPE_FILTERS: { id: string; label: string; type?: RowType }[] = [
  { id: "todas", label: "Todas" },
  { id: "acciones", label: "Acciones AR", type: "Acción" },
  { id: "cedears", label: "CEDEARs", type: "CEDEAR" },
];

/** Rubros de Finnhub más comunes, en castellano. Los que no están se muestran tal cual. */
const SECTOR_ES: Record<string, string> = {
  Technology: "Tecnología",
  Banking: "Bancos",
  "Financial Services": "Servicios financieros",
  Retail: "Comercio minorista",
  Media: "Medios",
  Beverages: "Bebidas",
  Automobiles: "Automotriz",
  "Oil & Gas": "Petróleo y gas",
  Energy: "Energía",
  Semiconductors: "Semiconductores",
  "Hotels, Restaurants & Leisure": "Restaurantes y ocio",
  Pharmaceuticals: "Farmacéuticas",
  Insurance: "Seguros",
  Utilities: "Servicios públicos",
  "Food Products": "Alimentos",
  Telecommunication: "Telecomunicaciones",
  "Real Estate": "Inmobiliario",
  Metals: "Metales",
  "Metals & Mining": "Minería",
};

export function sectorEs(s: string | null | undefined): string | null {
  if (!s) return null;
  return SECTOR_ES[s] ?? s;
}

export interface TableQuery {
  q: string;
  tipo: string;
  sector: string;
  orden: string;
  dir: "asc" | "desc";
  pag: number;
}

export function parseTableQuery(sp: Record<string, string | string[] | undefined>): TableQuery {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  };
  const orden = SORTABLE.has(one("orden")) ? one("orden") : "name";
  const dir = one("dir") === "desc" ? "desc" : one("dir") === "asc" ? "asc" : orden === "name" ? "asc" : "desc";
  const pag = Math.max(1, Number.parseInt(one("pag"), 10) || 1);
  const tipo = TYPE_FILTERS.some((t) => t.id === one("tipo")) ? one("tipo") : "todas";
  return { q: one("q"), tipo, sector: one("sector"), orden, dir, pag };
}

export function matchesQuery(row: ResearchRow, q: TableQuery): boolean {
  const type = TYPE_FILTERS.find((t) => t.id === q.tipo)?.type;
  if (type && row.type !== type) return false;
  if (q.sector && normalizeText(row.sector ?? "") !== normalizeText(q.sector)) return false;
  if (q.q && matchScore(q.q, row.symbol, [row.name, row.fundamentalsSymbol, ...row.aliases]) === 0) return false;
  return true;
}

/** Ordena sin perder filas: las que no tienen el dato van siempre al final, en cualquier dirección. */
export function sortRows(rows: ResearchRow[], orden: string, dir: "asc" | "desc"): ResearchRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (orden === "name") return a.name.localeCompare(b.name, "es") * sign;
    const va = a.metrics[orden] ?? null;
    const vb = b.metrics[orden] ?? null;
    if (va === null && vb === null) return a.name.localeCompare(b.name, "es");
    if (va === null) return 1;
    if (vb === null) return -1;
    return (va - vb) * sign;
  });
}

export function paginate<T>(rows: T[], page: number, size = PAGE_SIZE): { items: T[]; page: number; pages: number; total: number } {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const p = Math.min(Math.max(1, page), pages);
  return { items: rows.slice((p - 1) * size, p * size), page: p, pages, total: rows.length };
}

/** Arma la URL de la tabla cambiando algunos parámetros y volviendo a la página 1 si cambia el filtro u orden. */
export function tableHref(q: TableQuery, patch: Partial<TableQuery>): string {
  const next = { ...q, ...patch };
  if (!("pag" in patch)) next.pag = 1;
  // Al cambiar de columna se arranca por su dirección natural: nombre A→Z, métricas de mayor a menor.
  if (patch.orden && patch.orden !== q.orden && !patch.dir) next.dir = patch.orden === "name" ? "asc" : "desc";
  const sp = new URLSearchParams();
  if (next.q) sp.set("q", next.q);
  if (next.tipo !== "todas") sp.set("tipo", next.tipo);
  if (next.sector) sp.set("sector", next.sector);
  if (next.orden !== "name") sp.set("orden", next.orden);
  if (next.dir !== (next.orden === "name" ? "asc" : "desc")) sp.set("dir", next.dir);
  if (next.pag > 1) sp.set("pag", String(next.pag));
  const s = sp.toString();
  return s ? `/research?${s}` : "/research";
}
