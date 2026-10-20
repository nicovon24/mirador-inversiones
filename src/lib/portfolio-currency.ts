export type PortfolioCurrency = "ARS" | "MEP" | "BLUE";

/** Convierte solo para mostrar: los dólares que ya están en USD conservan su monto. */
export function convertPortfolioAmount(
  value: number | null,
  currency: "ARS" | "USD",
  display: PortfolioCurrency,
  rate: number | null,
): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (display === "ARS") return currency === "ARS" ? value : rate && rate > 0 ? value * rate : null;
  return currency === "USD" ? value : rate && rate > 0 ? value / rate : null;
}
