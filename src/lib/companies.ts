import { BONDS } from "@/lib/bonds";
import { CEDEAR_RATIOS } from "@/lib/cedears";
import type { SearchResult } from "@/lib/market/types";

/**
 * Catálogo de nombres para buscar por empresa y no solo por ticker ("galicia" → GGAL).
 * `adr` es el ticker en Nueva York de la misma empresa: se usa para traer datos fundamentales,
 * que el plan gratuito de Finnhub no entrega para BYMA.
 */
export interface Company {
  symbol: string;
  market: "AR" | "US";
  name: string;
  type: "Acción" | "CEDEAR" | "Bono";
  sector?: string;
  aliases?: string[];
  adr?: string;
}

const AR_STOCKS: Omit<Company, "market" | "type">[] = [
  { symbol: "GGAL", name: "Grupo Financiero Galicia", sector: "Bancos", aliases: ["galicia", "banco galicia"], adr: "GGAL" },
  { symbol: "YPFD", name: "YPF", sector: "Energía", aliases: ["ypf", "yacimientos petroliferos fiscales"], adr: "YPF" },
  { symbol: "PAMP", name: "Pampa Energía", sector: "Energía", aliases: ["pampa"], adr: "PAM" },
  { symbol: "BMA", name: "Banco Macro", sector: "Bancos", aliases: ["macro"], adr: "BMA" },
  { symbol: "BBAR", name: "BBVA Argentina", sector: "Bancos", aliases: ["bbva", "frances", "banco frances"], adr: "BBAR" },
  { symbol: "SUPV", name: "Grupo Supervielle", sector: "Bancos", aliases: ["supervielle"], adr: "SUPV" },
  { symbol: "CEPU", name: "Central Puerto", sector: "Energía", aliases: ["central puerto"], adr: "CEPU" },
  { symbol: "LOMA", name: "Loma Negra", sector: "Materiales", aliases: ["loma negra", "cemento"], adr: "LOMA" },
  { symbol: "TECO2", name: "Telecom Argentina", sector: "Telecomunicaciones", aliases: ["telecom", "personal"], adr: "TEO" },
  { symbol: "TGSU2", name: "Transportadora de Gas del Sur", sector: "Energía", aliases: ["tgs", "gas del sur"], adr: "TGS" },
  { symbol: "EDN", name: "Edenor", sector: "Servicios públicos", aliases: ["edenor", "electricidad"], adr: "EDN" },
  { symbol: "CRES", name: "Cresud", sector: "Agro", aliases: ["cresud"], adr: "CRESY" },
  { symbol: "IRSA", name: "IRSA", sector: "Inmobiliario", aliases: ["irsa inversiones", "shoppings"], adr: "IRS" },
  { symbol: "TXAR", name: "Ternium Argentina", sector: "Materiales", aliases: ["ternium", "siderar", "acero"] },
  { symbol: "ALUA", name: "Aluar", sector: "Materiales", aliases: ["aluar", "aluminio"] },
  { symbol: "COME", name: "Sociedad Comercial del Plata", sector: "Holding", aliases: ["comercial del plata"] },
  { symbol: "BYMA", name: "Bolsas y Mercados Argentinos", sector: "Finanzas", aliases: ["byma", "bolsa"] },
  { symbol: "VALO", name: "Grupo Financiero Valores", sector: "Bancos", aliases: ["valores", "banco de valores"] },
  { symbol: "CVH", name: "Cablevisión Holding", sector: "Telecomunicaciones", aliases: ["cablevision"] },
  { symbol: "MIRG", name: "Mirgor", sector: "Industria", aliases: ["mirgor"] },
  { symbol: "TGNO4", name: "Transportadora de Gas del Norte", sector: "Energía", aliases: ["tgn", "gas del norte"] },
  { symbol: "TRAN", name: "Transener", sector: "Servicios públicos", aliases: ["transener"] },
  { symbol: "METR", name: "Metrogas", sector: "Servicios públicos", aliases: ["metrogas"] },
  { symbol: "HARG", name: "Holcim Argentina", sector: "Materiales", aliases: ["holcim"] },
  { symbol: "MOLI", name: "Molinos Río de la Plata", sector: "Alimentos", aliases: ["molinos"] },
  { symbol: "LEDE", name: "Ledesma", sector: "Alimentos", aliases: ["ledesma", "azucar"] },
  { symbol: "BHIP", name: "Banco Hipotecario", sector: "Bancos", aliases: ["hipotecario"] },
  { symbol: "BPAT", name: "Banco Patagonia", sector: "Bancos", aliases: ["patagonia"] },
  { symbol: "GCLA", name: "Grupo Clarín", sector: "Medios", aliases: ["clarin"] },
  { symbol: "AGRO", name: "Agrometal", sector: "Industria", aliases: ["agrometal"] },
  { symbol: "CECO2", name: "Central Costanera", sector: "Energía", aliases: ["costanera"] },
  { symbol: "CGPA2", name: "Camuzzi Gas Pampeana", sector: "Servicios públicos", aliases: ["camuzzi"] },
];

const CEDEAR_ALIASES: Record<string, string[]> = {
  GOOGL: ["google"],
  META: ["facebook", "instagram", "whatsapp"],
  KO: ["coca cola", "coca"],
  MELI: ["mercado libre", "mercadolibre"],
  BRKB: ["berkshire", "buffett"],
  BABA: ["alibaba"],
  PBR: ["petrobras"],
  XOM: ["exxon"],
  MCD: ["mcdonalds"],
  JPM: ["jp morgan"],
  VIST: ["vista"],
};

const EXTRA_BONDS: { symbol: string; name: string }[] = [
  { symbol: "AL29", name: "Bonar 2029" },
  { symbol: "GD29", name: "Global 2029" },
  { symbol: "AL30", name: "Bonar 2030" },
  { symbol: "GD30", name: "Global 2030" },
];

export const COMPANIES: Company[] = [
  ...AR_STOCKS.map((c) => ({ ...c, market: "AR" as const, type: "Acción" as const })),
  ...Object.entries(CEDEAR_RATIOS).map(([symbol, c]) => ({
    symbol,
    market: "AR" as const,
    type: "CEDEAR" as const,
    name: c.name,
    aliases: CEDEAR_ALIASES[symbol],
    adr: c.underlying,
  })),
  ...[...BONDS.map((b) => ({ symbol: b.ticker, name: b.name })), ...EXTRA_BONDS].map((b) => ({
    symbol: b.symbol,
    market: "AR" as const,
    type: "Bono" as const,
    name: b.name,
    aliases: [b.name.replace(/\s+/g, "").toLowerCase()],
  })),
];

const BY_SYMBOL = new Map(COMPANIES.map((c) => [c.symbol, c]));

/** Empresa de un ticker de BYMA; acepta las especies en dólares (GGALD, AAPLC). */
export function findCompany(symbol: string): Company | undefined {
  const s = symbol.toUpperCase();
  return BY_SYMBOL.get(s) ?? (/[CD]$/.test(s) ? BY_SYMBOL.get(s.slice(0, -1)) : undefined);
}

export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/gi, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Puntaje de coincidencia de una consulta con un ticker y sus nombres. 0 = no coincide. */
export function matchScore(query: string, symbol: string, names: string[]): number {
  const q = normalizeText(query);
  if (!q) return 0;
  const sym = symbol.toLowerCase();
  if (sym === q.replace(/ /g, "")) return 100;
  if (sym.startsWith(q)) return 80;
  let best = 0;
  for (const raw of names) {
    const n = normalizeText(raw);
    if (!n) continue;
    if (n === q) best = Math.max(best, 70);
    else if (n.startsWith(q)) best = Math.max(best, 60);
    else if (n.split(" ").some((w) => w.startsWith(q))) best = Math.max(best, 50);
    else if (q.length >= 3 && n.includes(q)) best = Math.max(best, 30);
  }
  return best;
}

/** Búsqueda local por ticker, nombre o alias en el catálogo argentino. */
export function searchCompanies(query: string, limit = 10): SearchResult[] {
  return COMPANIES.map((c) => ({ c, score: matchScore(query, c.symbol, [c.name, ...(c.aliases ?? [])]) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.symbol.length - b.c.symbol.length)
    .slice(0, limit)
    .map(({ c }) => ({ symbol: c.symbol, market: c.market, name: c.name, type: c.type }));
}

/** ADRs de empresas argentinas del mismo sector, para comparar cuando el proveedor no trae comparables. */
export function sectorPeerAdrs(symbol: string): string[] {
  const c = findCompany(symbol);
  if (!c?.sector) return [];
  return COMPANIES.filter((o) => o.type === "Acción" && o.sector === c.sector && o.adr && o.symbol !== c.symbol).map((o) => o.adr!);
}
