/** Datos de cartera normalizados que se muestran en Mirador. */
export interface BrokerHolding {
  symbol: string;
  market?: "AR" | "US";
  name: string;
  type: string;
  currency: "ARS" | "USD";
  quantity: number;
  avgPrice: number | null;
  lastPrice: number;
  dayChangePct: number | null;
  pnl: number | null;
  pnlPct: number | null;
  value: number;
}

export interface BrokerCash {
  currency: "ARS" | "USD";
  available: number;
  total: number;
}
