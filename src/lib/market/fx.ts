import Decimal from "decimal.js";

/**
 * Dólar implícito en un bono que cotiza en pesos y en dólares:
 * MEP = AL30 / AL30D, CCL = AL30 / AL30C.
 * Se calcula con Decimal para no arrastrar errores de punto flotante.
 */
export function impliedRate(pricePesos: number, priceUsd: number): number | null {
  if (!(pricePesos > 0) || !(priceUsd > 0)) return null;
  return new Decimal(pricePesos).div(priceUsd).toDecimalPlaces(2).toNumber();
}

/** Variación % del tipo implícito a partir de las variaciones de cada especie. */
export function impliedChangePct(pesosChangePct: number, usdChangePct: number): number {
  const ratio = new Decimal(1).plus(new Decimal(pesosChangePct).div(100)).div(new Decimal(1).plus(new Decimal(usdChangePct).div(100)));
  return ratio.minus(1).times(100).toDecimalPlaces(2).toNumber();
}
