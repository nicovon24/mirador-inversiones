"use client";

import { BellPlus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CreateAlertDialog } from "@/components/alerts/create-alert-dialog";
import { HelpTip } from "@/components/help/help-tip";
import { ChangePill } from "@/components/market/change";
import { RangePicker } from "@/components/market/range-picker";
import { Sparkline } from "@/components/market/sparkline";
import { SymbolAvatar } from "@/components/market/symbol-avatar";
import { nextSort, SortHeader, type SortState } from "@/components/table/sort-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FavoriteButton } from "@/components/watchlist/favorite-button";
import { usePanel, useSparklineChunks } from "@/hooks/use-market";
import { findCompany, matchScore } from "@/lib/companies";
import { formatCompact, formatMoney, formatNumber } from "@/lib/format";
import type { Panel } from "@/lib/market";
import type { Quote } from "@/lib/market/types";
import { DEFAULT_PERIOD, PERIOD_LABEL, type PeriodRange } from "@/lib/series";
import { cn } from "@/lib/utils";

const PANELS: { id: Panel; label: string }[] = [
  { id: "acciones", label: "Acciones AR" },
  { id: "cedears", label: "CEDEARs" },
  { id: "bonos", label: "Bonos" },
  { id: "usa", label: "EE.UU." },
];

type SortKey = "symbol" | "price" | "changePct" | "volume";
type Currency = "ALL" | "ARS" | "USD";
const PAGE = 50;

export function MarketsTable({ watchedKeys }: { watchedKeys: string[] }) {
  const [panel, setPanel] = useState<Panel>("acciones");
  const [filter, setFilter] = useState("");
  const [currency, setCurrency] = useState<Currency>("ALL");
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "volume", dir: "desc" });
  const [range, setRange] = useState<PeriodRange>(DEFAULT_PERIOD);
  const [limit, setLimit] = useState(PAGE);
  const [alertFor, setAlertFor] = useState<Quote | null>(null);
  const { data, isLoading } = usePanel(panel);
  const watched = useMemo(() => new Set(watchedKeys), [watchedKeys]);

  const rows = useMemo(() => {
    const q = filter.trim();
    const list = (data?.quotes ?? [])
      .map((r) => (r.name || r.market !== "AR" ? r : { ...r, name: findCompany(r.symbol)?.name }))
      .filter((r) => {
        if (currency !== "ALL" && r.currency !== currency) return false;
        if (!q) return true;
        if (r.symbol.includes(q.toUpperCase())) return true;
        const c = r.market === "AR" ? findCompany(r.symbol) : undefined;
        return matchScore(q, r.symbol, [r.name ?? "", ...(c?.aliases ?? [])]) > 0;
      });
    const dir = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      if (sort.key === "symbol") return a.symbol.localeCompare(b.symbol) * dir;
      const va = sort.key === "volume" ? (a.volume ?? 0) * a.price : a[sort.key];
      const vb = sort.key === "volume" ? (b.volume ?? 0) * b.price : b[sort.key];
      return (va - vb) * dir;
    });
  }, [data, filter, currency, sort]);

  const toggleSort = (key: SortKey) => setSort((s) => nextSort(s, key, (k) => (k === "symbol" ? "asc" : "desc")));

  // Sparklines solo de las filas visibles: un panel tiene cientos de instrumentos.
  const visible = rows.slice(0, limit);
  const { series, isLoading: sparksLoading } = useSparklineChunks(
    visible.map((q) => `${q.market}:${q.symbol}`),
    range,
  );

  const showCurrency = panel === "cedears" || panel === "bonos";

  return (
    <section className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-0.5" role="tablist" aria-label="Panel">
          {PANELS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={panel === p.id}
              onClick={() => {
                setPanel(p.id);
                setLimit(PAGE);
                setCurrency("ALL");
              }}
              className={cn(
                "h-8 cursor-pointer rounded-md px-3 text-sm transition-colors",
                panel === p.id ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {showCurrency && (
          <div className="flex gap-1 rounded-lg border p-0.5" role="group" aria-label="Moneda">
            {(["ALL", "ARS", "USD"] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={currency === c}
                onClick={() => setCurrency(c)}
                className={cn(
                  "h-7 cursor-pointer rounded-md px-2.5 text-xs font-medium transition-colors",
                  currency === c ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c === "ALL" ? "Todas" : c === "ARS" ? "Pesos" : "Dólares"}
              </button>
            ))}
          </div>
        )}
        <RangePicker value={range} onChange={setRange} label="Período del gráfico" />
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Ticker o nombre (Galicia, Apple…)"
            aria-label="Filtrar por ticker o nombre"
            className="pl-8"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <SortHeader k="symbol" label="Instrumento" align="left" sort={sort} onSort={toggleSort} />
              <SortHeader k="price" label="Último" sort={sort} onSort={toggleSort} />
              <SortHeader k="changePct" label="Día" extra={<HelpTip id="variacion" />} sort={sort} onSort={toggleSort} />
              <th className="px-4 py-2.5 font-medium">Tendencia {PERIOD_LABEL[range]}</th>
              <th className="px-4 py-2.5 text-right font-medium" title="Variación en el período elegido">
                Var. {PERIOD_LABEL[range]}
              </th>
              <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">Compra / Venta</th>
              <SortHeader k="volume" label="Volumen" extra={<HelpTip id="volumen" />} sort={sort} onSort={toggleSort} />
              <th className="w-24 px-4 py-2.5">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && rows.length === 0 &&
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={8} className="px-4 py-2.5">
                    <Skeleton className="h-7 w-full" />
                  </td>
                </tr>
              ))}
            {visible.map((q) => {
              const key = `${q.market}:${q.symbol}`;
              const spark = series[key];
              return (
                <tr key={key} className="group transition-colors hover:bg-muted/40">
                  <td className="px-4 py-2">
                    <Link
                      href={`/instrument/${q.market}/${encodeURIComponent(q.symbol)}`}
                      className="flex items-center gap-3 hover:text-primary"
                    >
                      <SymbolAvatar symbol={q.symbol} className="size-7" />
                      <span className="min-w-0">
                        <span className="block font-medium">{q.symbol}</span>
                        {q.name && <span className="block max-w-56 truncate text-xs text-muted-foreground">{q.name}</span>}
                      </span>
                    </Link>
                  </td>
                  <td className="num px-4 py-2 text-right font-medium">{formatMoney(q.price, q.currency)}</td>
                  <td className="px-4 py-2 text-right">
                    <ChangePill pct={q.changePct} />
                  </td>
                  <td className="px-4 py-2">
                    {spark || sparksLoading ? (
                      <Sparkline
                        values={spark?.points ?? []}
                        times={spark?.times}
                        width={88}
                        height={26}
                        formatValue={(v) => formatMoney(v, q.currency)}
                      />
                    ) : (
                      <span className="text-muted-foreground" title="No hay histórico gratuito para este instrumento">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {spark ? <ChangePill pct={spark.changePct} /> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="num hidden px-4 py-2 text-right text-muted-foreground md:table-cell">
                    {q.bid || q.ask ? `${formatNumber(q.bid)} / ${formatNumber(q.ask)}` : "—"}
                  </td>
                  <td className="num px-4 py-2 text-right text-muted-foreground">{formatCompact(q.volume)}</td>
                  <td className="px-2 py-1 text-right">
                    <div className="flex justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Crear alerta para ${q.symbol}`}
                        onClick={() => setAlertFor(q)}
                        className="text-muted-foreground/70 hover:text-foreground"
                      >
                        <BellPlus />
                      </Button>
                      <FavoriteButton instrumentKey={key} name={q.name} active={watched.has(key)} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {data?.error ? "No pudimos traer este panel. Reintentamos en unos segundos." : `Nada coincide con “${filter}”.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
        <span className="num">
          {formatNumber(Math.min(limit, rows.length), 0)} de {formatNumber(rows.length, 0)}
        </span>
        {rows.length > limit && (
          <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
            Mostrar más
          </Button>
        )}
      </div>

      {alertFor && (
        <CreateAlertDialog
          open
          onOpenChange={(o) => !o && setAlertFor(null)}
          instrumentKey={`${alertFor.market}:${alertFor.symbol}`}
          symbol={alertFor.symbol}
          name={alertFor.name}
          price={alertFor.price}
        />
      )}
    </section>
  );
}
