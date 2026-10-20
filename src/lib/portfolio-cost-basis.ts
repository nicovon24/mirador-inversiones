export function costBasisKey(market: "AR" | "US", symbol: string, currency: "ARS" | "USD") {
  return `${market}:${symbol.toUpperCase()}:${currency}`;
}

export function parseCostBasis(raw: string): Record<string, number> {
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return Object.fromEntries(
      Object.entries(data).filter(([key, value]) =>
        /^[A-Z]{2}:[A-Z0-9._-]+:(ARS|USD)$/.test(key) && typeof value === "number" && Number.isFinite(value) && value > 0,
      ),
    );
  } catch {
    return {};
  }
}

export function parsePurchasePrice(input: string): number | null {
  const normalized = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,8})?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}
