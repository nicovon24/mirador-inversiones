"use client";

import { AlertTriangle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Change, ChangePill } from "@/components/market/change";
import { SymbolAvatar } from "@/components/market/symbol-avatar";
import { nextSort, SortHeader, type SortState } from "@/components/table/sort-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOverviewCards, useQuotes } from "@/hooks/use-market";
import { formatMoney, formatNumber, formatPercent, trend } from "@/lib/format";
import type { BrokerCash, BrokerHolding } from "@/lib/market/iol";
import { holdingNaturalDir, sortHoldings, summarize, valueHolding, type HoldingSortKey } from "@/lib/portfolio";
import { cn } from "@/lib/utils";
import { deletePosition } from "@/server/actions";
import type { PositionView } from "@/server/queries";

interface Row {
  id: string;
  origin: "IOL" | "Manual";
  symbol: string;
  market: "AR" | "US";
  name: string;
  type: string;
  currency: "ARS" | "USD";
  quantity: number;
  avgPrice: number | null;
  lastPrice: number | null;
  dayChangePct: number | null;
  value: number;
  cost: number | null;
  pnl: number | null;
  pnlPct: number | null;
}

const TYPE_LABEL: Record<string, string> = {
  ACCIONES: "Acciones",
  CEDEARS: "CEDEARs",
  TITULOSPUBLICOS: "Bonos",
  TITPUBLICOS: "Bonos",
  OBLIGACIONESNEGOCIABLES: "Obligaciones negociables",
  LETRAS: "Letras",
  FONDOCOMUNDEINVERSION: "FCI",
  CAUCIONESPESOS: "Cauciones",
};

function typeLabel(t: string) {
  // "TIT. PUBLICOS" y "Fondo Común de Inversión" (MCP) o "TitulosPublicos" (API v2) caen en la misma clave.
  const key = t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().replace(/[\s.]/g, "");
  return TYPE_LABEL[key] ?? t;
}

export function PortfolioScreen({
  broker,
  brokerError,
  cash,
  manual,
  iolConfigured,
}: {
  broker: BrokerHolding[];
  brokerError: string | null;
  cash: BrokerCash[];
  manual: PositionView[];
  iolConfigured: boolean;
}) {
  const { data: quotes } = useQuotes(manual.map((p) => p.key));
  const { data: overview } = useOverviewCards();
  const mep = overview?.cards.find((c) => c.id === "mep")?.quote?.price ?? null;
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [pending, start] = useTransition();

  const rows = useMemo<Row[]>(() => {
    const fromBroker: Row[] = broker.map((h, i) => ({
      id: `iol-${i}-${h.symbol}`,
      origin: "IOL",
      symbol: h.symbol,
      market: "AR",
      name: h.name,
      type: typeLabel(h.type),
      currency: h.currency,
      quantity: h.quantity,
      avgPrice: h.avgPrice,
      lastPrice: h.lastPrice,
      dayChangePct: h.dayChangePct,
      value: h.value,
      cost: h.pnl != null ? h.value - h.pnl : null,
      pnl: h.pnl,
      pnlPct: h.pnlPct,
    }));
    const fromManual: Row[] = manual.map((p) => {
      const q = quotes?.quotes[p.key];
      const price = q?.price ?? null;
      const valued = valueHolding({
        quantity: p.quantity,
        avgPrice: p.avgPrice,
        lastPrice: price ?? p.avgPrice,
        currency: p.currency as "ARS" | "USD",
      });
      return {
        id: p.id,
        origin: "Manual",
        symbol: p.symbol,
        market: p.market,
        name: q?.name ?? p.name ?? p.symbol,
        type: p.market === "US" ? "EE.UU." : "Manual",
        currency: p.currency as "ARS" | "USD",
        quantity: Number(p.quantity),
        avgPrice: Number(p.avgPrice),
        lastPrice: price,
        dayChangePct: q?.changePct ?? null,
        ...valued,
      };
    });
    return [...fromBroker, ...fromManual];
  }, [broker, manual, quotes]);

  const [sort, setSort] = useState<SortState<HoldingSortKey>>({ key: "value", dir: "desc" });
  const sortedRows = useMemo(() => sortHoldings(rows, sort.key, sort.dir, mep), [rows, sort, mep]);
  const toggleSort = (k: HoldingSortKey) => setSort((s) => nextSort(s, k, holdingNaturalDir));

  const cashRows = cash.map((c) => ({ value: c.total, cost: c.total, currency: c.currency }));
  const summary = summarize([...rows, ...cashRows], mep);

  const distribution = (() => {
    const toArs = (r: { value: number; currency: "ARS" | "USD" }) => (r.currency === "USD" ? (mep ? r.value * mep : 0) : r.value);
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.type, (map.get(r.type) ?? 0) + toArs(r));
    const cashArs = cash.reduce((s, c) => s + toArs({ value: c.total, currency: c.currency }), 0);
    if (cashArs > 0) map.set("Efectivo", cashArs);
    const total = [...map.values()].reduce((a, b) => a + b, 0) || 1;
    return [...map.entries()].map(([label, v]) => ({ label, value: v, pct: (v / total) * 100 })).sort((a, b) => b.value - a.value);
  })();

  const stat = (label: string, value: React.ReactNode, sub?: React.ReactNode) => (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="num text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {iolConfigured && brokerError && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden />
          No pudimos leer tu cuenta de InvertirOnline: {brokerError}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stat("Valor total", formatMoney(summary.totalArs), summary.totalUsd != null ? `≈ ${formatMoney(summary.totalUsd, "USD")} al MEP` : "Esperando dólar MEP…")}
        {stat(
          "Resultado del día",
          <span className={cn(trend(summary.dayPnlArs) === "up" && "text-up", trend(summary.dayPnlArs) === "down" && "text-down")}>
            {summary.dayPnlArs > 0 ? "+" : summary.dayPnlArs < 0 ? "−" : ""}
            {formatMoney(Math.abs(summary.dayPnlArs))}
          </span>,
        )}
        {stat(
          "Resultado total",
          summary.pnlArs != null ? (
            <span className={cn(trend(summary.pnlArs) === "up" && "text-up", trend(summary.pnlArs) === "down" && "text-down")}>
              {summary.pnlArs > 0 ? "+" : summary.pnlArs < 0 ? "−" : ""}
              {formatMoney(Math.abs(summary.pnlArs))}
            </span>
          ) : (
            "—"
          ),
          summary.pnlPct != null ? <Change pct={summary.pnlPct} showAbs={false} /> : "Sin precio de compra",
        )}
        {stat(
          "Efectivo disponible",
          cash.length ? formatMoney(cash.find((c) => c.currency === "ARS")?.available ?? 0) : "—",
          cash.find((c) => c.currency === "USD") ? `${formatMoney(cash.find((c) => c.currency === "USD")!.available, "USD")} en dólares` : iolConfigured ? undefined : "Solo con IOL",
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-xl border bg-card" aria-label="Tenencias">
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <h2 className="font-medium">Tenencias</h2>
            <p className="num text-xs text-muted-foreground">{rows.length} posiciones</p>
          </div>
          {rows.length === 0 ? (
            <p className="border-t px-4 py-12 text-center text-sm text-muted-foreground">
              Todavía no hay tenencias. Agregá una posición manual o conectá IOL.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <SortHeader k="symbol" label="Instrumento" align="left" sort={sort} onSort={toggleSort} />
                    <SortHeader k="quantity" label="Cantidad" sort={sort} onSort={toggleSort} />
                    <th className="px-4 py-2.5 text-right font-medium">PPC</th>
                    <SortHeader k="lastPrice" label="Último" sort={sort} onSort={toggleSort} />
                    <SortHeader k="dayChangePct" label="Día" sort={sort} onSort={toggleSort} />
                    <SortHeader k="value" label="Valuación" sort={sort} onSort={toggleSort} />
                    <SortHeader k="pnl" label="Resultado" sort={sort} onSort={toggleSort} />
                    <th className="w-10 px-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sortedRows.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/instrument/${r.market}/${encodeURIComponent(r.symbol)}`}
                          className="flex items-center gap-3 hover:text-primary"
                        >
                          <SymbolAvatar symbol={r.symbol} market={r.market} />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2 font-medium">
                              {r.symbol}
                              <Badge variant="outline" className="h-4 px-1 text-[10px] font-normal text-muted-foreground">
                                {r.origin}
                              </Badge>
                            </span>
                            <span className="block max-w-52 truncate text-xs text-muted-foreground">{r.name}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="num px-4 py-2.5 text-right">{formatNumber(r.quantity, r.quantity % 1 ? 2 : 0)}</td>
                      <td className="num px-4 py-2.5 text-right text-muted-foreground">
                        {r.avgPrice != null ? formatNumber(r.avgPrice) : "—"}
                      </td>
                      <td className="num px-4 py-2.5 text-right">{r.lastPrice != null ? formatNumber(r.lastPrice) : "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        <ChangePill pct={r.dayChangePct} />
                      </td>
                      <td className="num px-4 py-2.5 text-right font-medium">{formatMoney(r.value, r.currency)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {r.pnl != null ? (
                          <span className={cn("num flex flex-col items-end", trend(r.pnl) === "up" ? "text-up" : trend(r.pnl) === "down" ? "text-down" : "")}>
                            <span className="text-sm font-medium">
                              {r.pnl > 0 ? "+" : r.pnl < 0 ? "−" : ""}
                              {formatMoney(Math.abs(r.pnl), r.currency)}
                            </span>
                            <span className="text-xs">{formatPercent(r.pnlPct)}</span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-2">
                        {r.origin === "Manual" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setToDelete(r)}
                            aria-label={`Eliminar posición en ${r.symbol}`}
                            className="text-muted-foreground/70 hover:text-destructive"
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 xl:self-start" aria-label="Distribución">
          <h2 className="font-medium">Distribución</h2>
          {distribution.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos.</p>
          ) : (
            <>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                {distribution.map((d, i) => (
                  <span key={d.label} style={{ width: `${d.pct}%`, backgroundColor: `var(--chart-${(i % 5) + 1})` }} />
                ))}
              </div>
              <ul className="flex flex-col gap-2.5">
                {distribution.map((d, i) => (
                  <li key={d.label} className="flex items-center gap-2.5 text-sm">
                    <span className="size-2.5 rounded-sm" style={{ backgroundColor: `var(--chart-${(i % 5) + 1})` }} aria-hidden />
                    <span className="flex-1">{d.label}</span>
                    <span className="num text-muted-foreground">{formatMoney(d.value, "ARS", 0)}</span>
                    <span className="num w-14 text-right font-medium">{formatNumber(d.pct, 1)} %</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`¿Eliminar la posición en ${toDelete?.symbol ?? ""}?`}
        description="Solo se borra el registro manual; no afecta tu cuenta en ningún broker."
        confirmLabel="Eliminar posición"
        pending={pending}
        onConfirm={() =>
          start(async () => {
            if (!toDelete) return;
            const res = await deletePosition(toDelete.id);
            setToDelete(null);
            if (res.ok) toast.success("Posición eliminada");
            else toast.error(res.error);
          })
        }
      />
    </div>
  );
}
