"use client";

import { createContext, useContext } from "react";
import { useQuotes } from "@/hooks/use-market";
import { formatMoney } from "@/lib/format";
import type { Quote } from "@/lib/market/types";

const QuotesContext = createContext<Record<string, Quote> | undefined>(undefined);

/** Una sola consulta de cotizaciones (con polling) para todas las filas visibles de la página. */
export function LiveQuotesProvider({ keys, children }: { keys: string[]; children: React.ReactNode }) {
  const { data } = useQuotes(keys);
  return <QuotesContext.Provider value={data?.quotes}>{children}</QuotesContext.Provider>;
}

/** Precio actual de un instrumento, en su moneda. Se actualiza solo. */
export function LivePrice({ k }: { k: string }) {
  const q = useContext(QuotesContext)?.[k];
  if (!q) return <span className="inline-block h-4 w-16 animate-pulse rounded bg-muted/60 align-middle" aria-label="Cargando precio" />;
  return <span className="num font-medium">{formatMoney(q.price, q.currency)}</span>;
}
