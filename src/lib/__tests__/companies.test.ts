import { describe, expect, it } from "vitest";
import { findCompany, matchScore, searchCompanies } from "../companies";
import { compareSentence, median } from "../research";

const symbols = (q: string) => searchCompanies(q).map((r) => r.symbol);

describe("searchCompanies", () => {
  it("encuentra empresas por nombre o alias", () => {
    expect(symbols("galicia")[0]).toBe("GGAL");
    expect(symbols("Galicia")[0]).toBe("GGAL");
    expect(symbols("pampa")[0]).toBe("PAMP");
    expect(symbols("mercado libre")[0]).toBe("MELI");
    expect(symbols("google")[0]).toBe("GOOGL");
    expect(symbols("bonar 2035")[0]).toBe("AL35");
  });

  it("ignora tildes", () => {
    expect(symbols("pampa energia")[0]).toBe("PAMP");
    expect(symbols("clarín")[0]).toBe("GCLA");
  });

  it("prioriza el ticker exacto", () => {
    expect(symbols("YPF")[0]).toBe("YPFD");
    expect(symbols("ggal")[0]).toBe("GGAL");
  });

  it("no devuelve nada para texto sin coincidencias", () => {
    expect(searchCompanies("zzzz")).toEqual([]);
    expect(searchCompanies("  ")).toEqual([]);
  });
});

describe("findCompany", () => {
  it("resuelve las especies en dólares y el ADR", () => {
    expect(findCompany("GGALD")?.symbol).toBe("GGAL");
    expect(findCompany("YPFD")?.adr).toBe("YPF");
    expect(findCompany("AAPLC")?.type).toBe("CEDEAR");
    expect(findCompany("XXXX")).toBeUndefined();
  });
});

describe("matchScore", () => {
  it("no matchea fragmentos de 1 o 2 letras en mitad de palabra", () => {
    expect(matchScore("al", "GGAL", ["Grupo Financiero Galicia"])).toBe(0);
    expect(matchScore("gal", "GGAL", ["Grupo Financiero Galicia"])).toBeGreaterThan(0);
  });
});

describe("research helpers", () => {
  it("calcula la mediana ignorando valores no finitos", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([NaN, 5])).toBe(5);
    expect(median([])).toBeNull();
  });

  it("ubica el dato frente a sus comparables sin juzgarlo", () => {
    expect(compareSentence(30, 20)).toBe("Por encima de sus comparables");
    expect(compareSentence(10, 20)).toBe("Por debajo de sus comparables");
    expect(compareSentence(21, 20)).toBe("En línea con sus comparables");
    expect(compareSentence(null, 20)).toBeNull();
  });
});

describe("sectorPeerAdrs", () => {
  it("devuelve los ADR del mismo sector sin incluir a la propia empresa", async () => {
    const { sectorPeerAdrs } = await import("../companies");
    expect(sectorPeerAdrs("GGAL")).toEqual(expect.arrayContaining(["BMA", "BBAR", "SUPV"]));
    expect(sectorPeerAdrs("GGAL")).not.toContain("GGAL");
    expect(sectorPeerAdrs("ALUA")).toEqual(["LOMA"]);
    expect(sectorPeerAdrs("MOLI")).toEqual([]);
  });
});
