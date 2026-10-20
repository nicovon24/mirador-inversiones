import type { BrokerCash, BrokerHolding } from "@/lib/broker-types";
import { IolError } from "./errors";
import type { IolGateway } from "./gateway";
import { payloadOf } from "./mcp-client";

/**
 * Cartera en vivo desde el MCP de IOL. Nada se guarda ni se loguea: los montos solo viven durante el pedido.
 * Si IOL incluye el PPC en la respuesta, se usa para calcular el resultado acumulado.
 */

const PORTFOLIO_TOOL = "get_portfolio";
const BALANCE_TOOL = "get_balance";
const DEFAULT_COUNTRIES = ["argentina", "estados_Unidos"];
const TERMS = ["t0", "t1", "t2", "t3"] as const;

type Json = Record<string, unknown>;

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function mapCurrency(v: unknown): "ARS" | "USD" | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (["ars", "peso_argentino", "peso argentino"].includes(s)) return "ARS";
  if (["usd", "dolar_estadounidense", "dolar estadounidense"].includes(s)) return "USD";
  return null;
}

export function mapHoldings(payload: unknown, market: "AR" | "US" = "AR"): BrokerHolding[] {
  const positions = ((payload as Json)?.positions ?? []) as Json[];
  const out: BrokerHolding[] = [];
  for (const p of Array.isArray(positions) ? positions : []) {
    const asset = (p.asset ?? {}) as Json;
    const currency = mapCurrency(asset.currency);
    const symbol = typeof asset.symbol === "string" ? asset.symbol : "";
    if (!currency || !symbol) continue;
    const quantity = num(p.quantity) ?? 0;
    // unit_price = lot_price / units_per_lot (los bonos cotizan cada 100 nominales).
    const lot = num(p.lot_price);
    const perLot = num(asset.units_per_lot) ?? 1;
    const unitPrice = num(p.unit_price) ?? (lot !== null && perLot > 0 ? lot / perLot : 0);
    const unitAvg = num(p.average_unit_price) ?? num(p.average_price) ?? num(p.avg_price) ?? num(p.average_purchase_price) ?? num(p.purchase_price) ?? num(p.ppc);
    const lotAvg = num(p.average_lot_price);
    const avgPrice = unitAvg ?? (lotAvg !== null && perLot > 0 ? lotAvg / perLot : null);
    const unitAvgPrice = avgPrice !== null && avgPrice > 0 ? avgPrice : null;
    const value = quantity * unitPrice;
    const cost = unitAvgPrice === null ? null : quantity * unitAvgPrice;
    const pnl = cost === null ? null : value - cost;
    out.push({
      symbol,
      market,
      name: typeof asset.description === "string" ? asset.description : symbol,
      type: typeof asset.type === "string" ? asset.type : "",
      currency,
      quantity,
      avgPrice: unitAvgPrice,
      lastPrice: unitPrice,
      dayChangePct: num(p.daily_change_pct),
      pnl,
      pnlPct: cost && pnl !== null ? (pnl / cost) * 100 : null,
      value,
    });
  }
  return out;
}

/** Suma los plazos t0..t3 de cada cuenta (no son acumulativos) y agrupa por moneda. */
export function mapBalance(payload: unknown): BrokerCash[] {
  const totals = new Map<"ARS" | "USD", { available: number; total: number }>();
  for (const [key, account] of Object.entries((payload ?? {}) as Json)) {
    const currency = mapCurrency(key.slice(key.lastIndexOf("_") + 1));
    if (!currency || typeof account !== "object" || account === null) continue;
    const a = account as Json;
    const sum = (field: string) => TERMS.reduce((s, t) => s + (num((a[field] as Json | undefined)?.[t]) ?? 0), 0);
    const prev = totals.get(currency) ?? { available: 0, total: 0 };
    totals.set(currency, { available: prev.available + sum("available"), total: prev.total + sum("totals") });
  }
  return [...totals.entries()].map(([currency, v]) => ({ currency, ...v }));
}

export async function getMcpPortfolio(gateway: IolGateway, userId: string): Promise<{ holdings: BrokerHolding[]; cash: BrokerCash[] }> {
  const schema = await gateway.toolSchema(userId, PORTFOLIO_TOOL);
  const countryEnum = ((schema?.properties as Json | undefined)?.country as Json | undefined)?.enum;
  const countries = Array.isArray(countryEnum) && countryEnum.length > 0 ? countryEnum.map(String) : DEFAULT_COUNTRIES;

  const results = await gateway.callReadTools(userId, [
    ...countries.map((country) => ({ tool: PORTFOLIO_TOOL, arguments: { country } })),
    { tool: BALANCE_TOOL },
  ]);

  const holdings: BrokerHolding[] = [];
  let cash: BrokerCash[] = [];
  let anyPortfolio = false;
  for (const r of results) {
    if (r.status !== "success") continue;
    const payload = payloadOf(r.result);
    if (r.call.tool === PORTFOLIO_TOOL) {
      anyPortfolio = true;
      const country = String(r.call.arguments?.country ?? "").toLowerCase();
      holdings.push(...mapHoldings(payload, /unidos|united|usa/.test(country) ? "US" : "AR"));
    } else if (r.call.tool === BALANCE_TOOL) {
      cash = mapBalance(payload);
    }
  }
  // Un país que falla no oculta a los otros; solo es error si no se pudo leer ninguno.
  if (!anyPortfolio) throw new IolError(502, "IOL no devolvió la cartera. Intentá nuevamente en unos minutos", "invalid_response");
  return { holdings, cash };
}
