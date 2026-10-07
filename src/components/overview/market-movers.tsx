"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChangePill } from "@/components/market/change";
import { SymbolAvatar } from "@/components/market/symbol-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { usePanel } from "@/hooks/use-market";
import { formatCompact, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tab = "active" | "gainers" | "losers";
const TABS: { id: Tab; label: string }[] = [
  { id: "active", label: "Más operadas" },
  { id: "gainers", label: "Mayores subas" },
  { id: "losers", label: "Mayores bajas" },
];

export function MarketMovers() {
  const [market, setMarket] = useState<"acciones" | "usa">("acciones");
  const [tab, setTab] = useState<Tab>("active");
  const { data, isLoading } = usePanel(market);

  const rows = useMemo(() => {
    // Solo instrumentos con volumen real para no mostrar "subas" de especies sin operar.
    const list = (data?.quotes ?? []).filter((q) => (q.volume ?? 0) > 0);
    const sorted =
      tab === "active"
        ? [...list].sort((a, b) => (b.volume ?? 0) * b.price - (a.volume ?? 0) * a.price)
        : tab === "gainers"
          ? [...list].sort((a, b) => b.changePct - a.changePct)
          : [...list].sort((a, b) => a.changePct - b.changePct);
    return sorted.slice(0, 8);
  }, [data, tab]);

  return (
    <section className="rounded-xl border bg-card" aria-label="Movimientos del mercado">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <h2 className="font-medium">Movimientos del mercado</h2>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg bg-muted p-0.5" role="group" aria-label="Mercado">
            {(["acciones", "usa"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={market === m}
                onClick={() => setMarket(m)}
                className={cn(
                  "h-7 cursor-pointer rounded-md px-2.5 text-xs font-medium transition-colors",
                  market === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "acciones" ? "Argentina" : "EE.UU."}
              </button>
            ))}
          </div>
          <Link href="/markets" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            Ver mercado <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>

      <div className="mt-2 flex gap-5 border-b px-4" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px cursor-pointer border-b-2 py-2.5 text-sm transition-colors",
              tab === t.id
                ? "border-primary font-medium text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-left text-[11px] text-muted-foreground">
              <th className="px-4 py-2 font-medium">Instrumento</th>
              <th className="px-4 py-2 text-right font-medium">Precio</th>
              <th className="px-4 py-2 text-right font-medium">Variación</th>
              <th className="px-4 py-2 text-right font-medium">Volumen</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && rows.length === 0
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={4} className="px-4 py-2.5">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              : rows.map((q) => (
                  <tr key={q.symbol} className="transition-colors hover:bg-muted/50">
                    <td className="px-4 py-2">
                      <Link
                        href={`/instrument/${q.market}/${encodeURIComponent(q.symbol)}`}
                        className="flex items-center gap-3 font-medium hover:text-primary"
                      >
                        <SymbolAvatar symbol={q.symbol} className="size-7" />
                        {q.symbol}
                      </Link>
                    </td>
                    <td className="num px-4 py-2 text-right">{formatMoney(q.price, q.currency)}</td>
                    <td className="px-4 py-2 text-right">
                      <ChangePill pct={q.changePct} />
                    </td>
                    <td className="num px-4 py-2 text-right text-muted-foreground">{formatCompact(q.volume)}</td>
                  </tr>
                ))}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {data?.error ? "No pudimos traer el panel. Reintentamos en unos segundos." : "El mercado todavía no operó hoy."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
