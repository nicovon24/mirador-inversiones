"use client";

import { BellPlus, CandlestickChart, Download, LineChart, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CreateAlertDialog } from "@/components/alerts/create-alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { FavoriteButton } from "@/components/watchlist/favorite-button";
import { useHistory, useQuotes } from "@/hooks/use-market";
import { formatCompact, formatMoney, formatNumber, formatTime } from "@/lib/format";
import { parseKey, RANGES, type Range } from "@/lib/market/types";
import { cn } from "@/lib/utils";
import { Change } from "./change";
import { PriceChart, type ChartMode } from "./price-chart";
import { SymbolAvatar } from "./symbol-avatar";

const SOURCE_LABEL: Record<string, string> = {
  iol: "IOL",
  finnhub: "Finnhub",
  yahoo: "Yahoo",
  data912: "data912",
  argentinadatos: "ArgentinaDatos",
};

function exportCsv(symbol: string, rows: { time: number; open: number; high: number; low: number; close: number; volume?: number }[]) {
  const header = "fecha;apertura;maximo;minimo;cierre;volumen";
  const lines = rows.map((r) =>
    [new Date(r.time * 1000).toISOString(), r.open, r.high, r.low, r.close, r.volume ?? ""]
      .map((v) => String(v).replace(".", ","))
      .join(";"),
  );
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${symbol}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ChartPanel({
  instrumentKey,
  name,
  watched,
  showLink = true,
  height = 340,
}: {
  instrumentKey: string;
  /** Nombre conocido (p. ej. guardado en la base) por si el proveedor no lo trae. */
  name?: string | null;
  watched: boolean;
  showLink?: boolean;
  height?: number;
}) {
  const [range, setRange] = useState<Range>("1M");
  const [mode, setMode] = useState<ChartMode>("line");
  const [alertOpen, setAlertOpen] = useState(false);
  const parsed = parseKey(instrumentKey)!;
  const { data: quoteData } = useQuotes([instrumentKey]);
  const { data: history, isLoading } = useHistory(instrumentKey, range);
  const quote = quoteData?.quotes[instrumentKey];
  const candles = history?.candles ?? [];
  const isIndex = parsed.symbol.startsWith("^");
  const displayName = quote?.name ?? name ?? parsed.symbol;
  // Si el proveedor no trae OHLC del día, usamos la última vela diaria cuando es de hoy.
  const last = candles.at(-1);
  const today = last && !["1D", "1W"].includes(range) && new Date(last.time * 1000).toDateString() === new Date().toDateString() ? last : undefined;

  const stats = [
    { label: "Apertura", value: quote?.open ?? today?.open },
    { label: "Máximo del día", value: quote?.high ?? today?.high },
    { label: "Mínimo del día", value: quote?.low ?? today?.low },
    { label: "Cierre anterior", value: quote?.prevClose },
  ];

  return (
    <section className="rounded-xl border bg-card" aria-label={`Gráfico de ${parsed.symbol}`}>
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 pb-2">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-3">
            <SymbolAvatar symbol={parsed.symbol} market={parsed.market} />
            <div className="min-w-0">
              {showLink ? (
                <Link
                  href={`/instrument/${parsed.market}/${encodeURIComponent(parsed.symbol)}`}
                  className="block truncate font-medium hover:text-primary"
                >
                  {displayName}
                </Link>
              ) : (
                <p className="truncate font-medium">{displayName}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {parsed.symbol} · {parsed.market === "AR" ? "BYMA" : "EE.UU."}
                {quote && <> · {SOURCE_LABEL[quote.source]}{quote.delayed ? " (puede tener demora)" : ""}</>}
              </p>
            </div>
            {!isIndex && <FavoriteButton instrumentKey={instrumentKey} name={displayName} active={watched} />}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {quote ? (
              <>
                <span className="num text-3xl font-semibold tracking-tight">
                  {isIndex ? formatNumber(quote.price) : formatMoney(quote.price, quote.currency)}
                </span>
                <Change change={quote.change} pct={quote.changePct} className="text-sm" />
              </>
            ) : (
              <Skeleton className="h-9 w-48" />
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5" role="group" aria-label="Rango">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={cn(
                  "h-7 min-w-9 cursor-pointer rounded-md px-2 text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  range === r ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r === "ALL" ? "Todo" : r}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5 rounded-lg border p-0.5" role="group" aria-label="Tipo de gráfico">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-pressed={mode === "line"}
                aria-label="Línea"
                onClick={() => setMode("line")}
                className={cn(mode === "line" && "bg-accent text-accent-foreground")}
              >
                <LineChart />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-pressed={mode === "candles"}
                aria-label="Velas"
                onClick={() => setMode("candles")}
                className={cn(mode === "candles" && "bg-accent text-accent-foreground")}
              >
                <CandlestickChart />
              </Button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Más acciones" />}>
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {!isIndex && (
                  <DropdownMenuItem onClick={() => setAlertOpen(true)}>
                    <BellPlus /> Crear alerta de precio
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem disabled={candles.length === 0} onClick={() => exportCsv(parsed.symbol, candles)}>
                  <Download /> Exportar datos (CSV)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="relative px-2">
        {isLoading && candles.length === 0 ? (
          <Skeleton className="mx-3 rounded-lg" style={{ height }} />
        ) : candles.length === 0 ? (
          <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
            No hay datos históricos para este rango.
          </div>
        ) : (
          <PriceChart candles={candles} mode={mode} range={range} height={height} />
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t px-5 py-4 sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="num text-sm font-medium">{s.value != null ? formatNumber(s.value) : "—"}</dd>
          </div>
        ))}
        <div>
          <dt className="text-xs text-muted-foreground">Volumen</dt>
          <dd className="num text-sm font-medium">{quote?.volume ? formatCompact(quote.volume) : "—"}</dd>
        </div>
      </dl>
      {quote && (
        <p className="sr-only" aria-live="polite">
          {parsed.symbol} {formatNumber(quote.price)}, actualizado {formatTime(quote.timestamp)}
        </p>
      )}

      <CreateAlertDialog
        open={alertOpen}
        onOpenChange={setAlertOpen}
        instrumentKey={instrumentKey}
        symbol={parsed.symbol}
        name={displayName}
        price={quote?.price}
      />
    </section>
  );
}
