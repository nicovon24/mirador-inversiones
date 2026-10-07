import Decimal from "decimal.js";

/**
 * Ratios de conversión de CEDEARs frecuentes (RF-15): cuántos CEDEARs equivalen a 1 acción del exterior.
 * Es una tabla de referencia cargada a mano: los ratios pueden cambiar (splits, ajustes de BYMA).
 * `cedearImplied` descarta el resultado si da una brecha absurda, que suele indicar un ratio desactualizado.
 */
export const CEDEAR_RATIOS: Record<string, { underlying: string; name: string; ratio: number }> = {
  AAPL: { underlying: "AAPL", name: "Apple", ratio: 20 },
  MSFT: { underlying: "MSFT", name: "Microsoft", ratio: 30 },
  GOOGL: { underlying: "GOOGL", name: "Alphabet", ratio: 58 },
  AMZN: { underlying: "AMZN", name: "Amazon", ratio: 144 },
  TSLA: { underlying: "TSLA", name: "Tesla", ratio: 15 },
  NVDA: { underlying: "NVDA", name: "NVIDIA", ratio: 24 },
  META: { underlying: "META", name: "Meta Platforms", ratio: 24 },
  KO: { underlying: "KO", name: "Coca-Cola", ratio: 5 },
  MELI: { underlying: "MELI", name: "MercadoLibre", ratio: 120 },
  JPM: { underlying: "JPM", name: "JPMorgan Chase", ratio: 15 },
  WMT: { underlying: "WMT", name: "Walmart", ratio: 18 },
  V: { underlying: "V", name: "Visa", ratio: 18 },
  MCD: { underlying: "MCD", name: "McDonald's", ratio: 24 },
  BABA: { underlying: "BABA", name: "Alibaba", ratio: 9 },
  NFLX: { underlying: "NFLX", name: "Netflix", ratio: 48 },
  BRKB: { underlying: "BRK.B", name: "Berkshire Hathaway", ratio: 22 },
  PBR: { underlying: "PBR", name: "Petrobras", ratio: 1 },
  XOM: { underlying: "XOM", name: "ExxonMobil", ratio: 10 },
  VIST: { underlying: "VIST", name: "Vista Energy", ratio: 3 },
};

/** Si la brecha supera este valor se considera que el ratio de la tabla no es confiable. */
const MAX_PLAUSIBLE_GAP = 0.25;

export interface CedearImplied {
  /** Dólar implícito: precio del CEDEAR × ratio ÷ precio de la acción en USD. */
  impliedFx: number;
  /** Brecha del dólar implícito contra el CCL de referencia, como fracción (0,02 = 2 %). */
  gap: number;
  /** Precio teórico del CEDEAR en pesos según el CCL de referencia. */
  theoreticalPrice: number;
}

export function cedearImplied(
  cedearPriceArs: number,
  underlyingPriceUsd: number,
  ratio: number,
  referenceCcl: number,
): CedearImplied | null {
  if (!(cedearPriceArs > 0) || !(underlyingPriceUsd > 0) || !(ratio > 0) || !(referenceCcl > 0)) return null;
  const impliedFx = new Decimal(cedearPriceArs).times(ratio).div(underlyingPriceUsd);
  const gap = impliedFx.div(referenceCcl).minus(1);
  if (gap.abs().gt(MAX_PLAUSIBLE_GAP)) return null;
  const theoreticalPrice = new Decimal(underlyingPriceUsd).times(referenceCcl).div(ratio);
  return {
    impliedFx: impliedFx.toDecimalPlaces(2).toNumber(),
    gap: gap.toDecimalPlaces(4).toNumber(),
    theoreticalPrice: theoreticalPrice.toDecimalPlaces(2).toNumber(),
  };
}
