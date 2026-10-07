import { describe, expect, it } from "vitest";
import { matchesQuery, paginate, parseTableQuery, sortRows, tableHref, type ResearchRow } from "../research-table";

function row(symbol: string, name: string, patch: Partial<ResearchRow> = {}): ResearchRow {
  return {
    key: `AR:${symbol}`,
    symbol,
    name,
    type: "Acción",
    sector: "Bancos",
    aliases: [],
    fundamentalsSymbol: symbol,
    metrics: {},
    status: "ok",
    fetchedAt: null,
    stale: false,
    ...patch,
  };
}

const ggal = row("GGAL", "Grupo Financiero Galicia", { aliases: ["galicia"], metrics: { peTTM: 90 } });
const bma = row("BMA", "Banco Macro", { metrics: { peTTM: 23 } });
const pamp = row("PAMP", "Pampa Energía", { sector: "Energía", metrics: { peTTM: 12 } });
const aapl = row("AAPL", "Apple", { type: "CEDEAR", sector: "Tecnología", metrics: {} });

describe("parseTableQuery", () => {
  it("usa valores por defecto seguros", () => {
    expect(parseTableQuery({})).toEqual({ q: "", tipo: "todas", sector: "", orden: "name", dir: "asc", pag: 1 });
  });

  it("descarta columnas, tipos y páginas inválidas", () => {
    const q = parseTableQuery({ orden: "DROP TABLE", tipo: "x", pag: "-3" });
    expect(q.orden).toBe("name");
    expect(q.tipo).toBe("todas");
    expect(q.pag).toBe(1);
  });

  it("ordena las métricas de mayor a menor por defecto", () => {
    expect(parseTableQuery({ orden: "peTTM" }).dir).toBe("desc");
    expect(parseTableQuery({ orden: "peTTM", dir: "asc" }).dir).toBe("asc");
  });
});

describe("matchesQuery", () => {
  const base = parseTableQuery({});
  it("filtra por nombre, alias, tipo y sector", () => {
    expect(matchesQuery(ggal, { ...base, q: "galicia" })).toBe(true);
    expect(matchesQuery(bma, { ...base, q: "galicia" })).toBe(false);
    expect(matchesQuery(aapl, { ...base, tipo: "cedears" })).toBe(true);
    expect(matchesQuery(ggal, { ...base, tipo: "cedears" })).toBe(false);
    expect(matchesQuery(pamp, { ...base, sector: "energia" })).toBe(true);
    expect(matchesQuery(ggal, { ...base, sector: "Energía" })).toBe(false);
  });
});

describe("sortRows", () => {
  it("ordena por métrica y deja sin dato al final en ambas direcciones", () => {
    expect(sortRows([aapl, ggal, pamp, bma], "peTTM", "desc").map((r) => r.symbol)).toEqual(["GGAL", "BMA", "PAMP", "AAPL"]);
    expect(sortRows([aapl, ggal, pamp, bma], "peTTM", "asc").map((r) => r.symbol)).toEqual(["PAMP", "BMA", "GGAL", "AAPL"]);
  });

  it("ordena por nombre en castellano", () => {
    expect(sortRows([pamp, ggal, aapl, bma], "name", "asc").map((r) => r.symbol)).toEqual(["AAPL", "BMA", "GGAL", "PAMP"]);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 30 }, (_, i) => i);
  it("corta en páginas y acota la página pedida", () => {
    expect(paginate(items, 1, 25).items).toHaveLength(25);
    expect(paginate(items, 2, 25).items).toEqual([25, 26, 27, 28, 29]);
    expect(paginate(items, 99, 25).page).toBe(2);
    expect(paginate([], 1, 25)).toEqual({ items: [], page: 1, pages: 1, total: 0 });
  });
});

describe("tableHref", () => {
  const base = parseTableQuery({ q: "banco", pag: "3" });
  it("vuelve a la página 1 al cambiar filtro u orden", () => {
    expect(tableHref(base, { orden: "peTTM" })).toBe("/research?q=banco&orden=peTTM");
  });
  it("conserva el resto al paginar", () => {
    expect(tableHref(base, { pag: 4 })).toBe("/research?q=banco&pag=4");
    expect(tableHref(parseTableQuery({}), {})).toBe("/research");
  });
});
