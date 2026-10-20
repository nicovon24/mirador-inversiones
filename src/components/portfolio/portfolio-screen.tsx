"use client";

import { AlertTriangle, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ChangePill } from "@/components/market/change";
import { SymbolAvatar } from "@/components/market/symbol-avatar";
import { HoldingsPieChart, type HoldingSlice } from "@/components/portfolio/holdings-pie-chart";
import { PortfolioResultCard } from "@/components/portfolio/portfolio-result-card";
import { nextSort, SortHeader, type SortState } from "@/components/table/sort-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBlueRate, useOverviewCards, useQuotes } from "@/hooks/use-market";
import { formatMoney, formatNumber, formatPercent, trend } from "@/lib/format";
import type { BrokerCash, BrokerHolding } from "@/lib/broker-types";
import { convertPortfolioAmount, type PortfolioCurrency } from "@/lib/portfolio-currency";
import { costBasisKey, parseCostBasis, parsePurchasePrice } from "@/lib/portfolio-cost-basis";
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
  costBasisOwner,
}: {
  broker: BrokerHolding[];
  brokerError: string | null;
  cash: BrokerCash[];
  manual: PositionView[];
  iolConfigured: boolean;
  costBasisOwner: string;
}) {
  const storageKey = `mirador:iol-ppc:${costBasisOwner}`;
  const storedPrices = useSyncExternalStore(
    (callback) => {
      const onChange = () => callback();
      window.addEventListener("storage", onChange);
      window.addEventListener("mirador:ppc-change", onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener("mirador:ppc-change", onChange);
      };
    },
    () => {
      try { return window.localStorage.getItem(storageKey) ?? ""; } catch { return ""; }
    },
    () => "",
  );
  const customPrices = useMemo(() => parseCostBasis(storedPrices), [storedPrices]);
  const [editing, setEditing] = useState<Row | null>(null);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const savePurchasePrice = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const price = parsePurchasePrice(purchasePrice);
    if (price === null) return setPurchaseError("Ingresá un precio positivo, sin separador de miles.");
    const key = costBasisKey(editing.market, editing.symbol, editing.currency);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ ...customPrices, [key]: price }));
      window.dispatchEvent(new Event("mirador:ppc-change"));
      setEditing(null);
      toast.success(`PPC de ${editing.symbol} guardado en este navegador`);
    } catch {
      setPurchaseError("No se pudo guardar en este navegador.");
    }
  };
  const { data: quotes } = useQuotes(manual.map((p) => p.key));
  const { data: overview } = useOverviewCards();
  const { data: blueQuote } = useBlueRate();
  const mep = overview?.cards.find((c) => c.id === "mep")?.quote?.price ?? null;
  const [display, setDisplay] = useState<PortfolioCurrency>("ARS");
  const rate = display === "BLUE" ? blueQuote?.rate ?? null : mep;
  const displayCurrency = display === "ARS" ? "ARS" : "USD";
  const convert = (value: number | null, currency: "ARS" | "USD") => convertPortfolioAmount(value, currency, display, rate);
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [pending, start] = useTransition();

  const rows = useMemo<Row[]>(() => {
    const fromBroker: Row[] = broker.map((h, i) => {
      const override = customPrices[costBasisKey(h.market ?? "AR", h.symbol, h.currency)];
      const avgPrice = override ?? h.avgPrice;
      const cost = override ? h.quantity * override : h.pnl != null ? h.value - h.pnl : avgPrice != null ? h.quantity * avgPrice : null;
      const pnl = cost === null ? null : h.value - cost;
      return ({
      id: `iol-${i}-${h.symbol}`,
      origin: "IOL",
      symbol: h.symbol,
      market: h.market ?? "AR",
      name: h.name,
      type: typeLabel(h.type),
      currency: h.currency,
      quantity: h.quantity,
      avgPrice,
      lastPrice: h.lastPrice,
      dayChangePct: h.dayChangePct,
      value: h.value,
      cost,
      pnl,
      pnlPct: cost && pnl !== null ? (pnl / cost) * 100 : h.pnlPct,
    });
    });
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
  }, [broker, manual, quotes, customPrices]);

  const duplicateKeys = useMemo(() => {
    const imported = new Set(broker.map((h) => `${h.market ?? "AR"}:${h.symbol.toUpperCase()}`));
    return [...new Set(manual.filter((p) => imported.has(`${p.market}:${p.symbol.toUpperCase()}`)).map((p) => p.symbol))];
  }, [broker, manual]);

  const [sort, setSort] = useState<SortState<HoldingSortKey>>({ key: "value", dir: "desc" });
  const sortedRows = useMemo(() => sortHoldings(rows, sort.key, sort.dir, rate), [rows, sort, rate]);
  const toggleSort = (k: HoldingSortKey) => setSort((s) => nextSort(s, k, holdingNaturalDir));

  // IOL's balance fields need reconciliation against the provider's account total.
  // Until their settlement semantics are confirmed, show a holdings subtotal.
  const summary = summarize(rows, rate ?? 1);
  const resultSummary = summary;
  const hasArs = rows.some((item) => item.currency === "ARS");
  const hasUsd = rows.some((item) => item.currency === "USD");
  const displayReady = display === "ARS" ? !hasUsd || Boolean(rate) : !hasArs || Boolean(rate);
  const totalValue = displayReady ? (display === "ARS" ? summary.totalArs : summary.totalArs / (rate ?? 1)) : null;
  const cashDisplayReady = display === "ARS" ? !cash.some((item) => item.currency === "USD") || Boolean(rate) : !cash.some((item) => item.currency === "ARS") || Boolean(rate);
  const availableCash = cash.length && cashDisplayReady
    ? cash.reduce((sum, item) => sum + (convert(item.available, item.currency) ?? 0), 0)
    : null;

  const distribution = (() => {
    if (!displayReady) return [];
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.type, (map.get(r.type) ?? 0) + (convert(r.value, r.currency) ?? 0));
    const total = [...map.values()].reduce((a, b) => a + b, 0) || 1;
    return [...map.entries()].map(([label, v]) => ({ label, value: v, pct: (v / total) * 100 })).sort((a, b) => b.value - a.value);
  })();

  const holdingsDistribution: HoldingSlice[] = (() => {
    if (!displayReady) return [];
    const values = new Map<string, { label: string; value: number }>();
    for (const row of rows) {
      const value = convert(row.value, row.currency) ?? 0;
      if (!Number.isFinite(value) || value <= 0) continue;
      const key = `${row.market}:${row.symbol}`;
      values.set(key, { label: `${row.symbol} · ${row.market}`, value: (values.get(key)?.value ?? 0) + value });
    }
    const total = [...values.values()].reduce((sum, item) => sum + item.value, 0);
    return [...values.entries()]
      .map(([key, item]) => ({ key, ...item, pct: (item.value / total) * 100 }))
      .sort((a, b) => b.value - a.value);
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
      {duplicateKeys.length > 0 && (
        <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
          Hay posiciones manuales que también figuran en IOL: {duplicateKeys.join(", ")}. El subtotal incluye ambas hasta que revises las posiciones manuales.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Mostrar importes en</p>
        <div className="flex flex-wrap gap-0.5 rounded-lg bg-muted p-0.5" role="group" aria-label="Moneda del portafolio">
          {([
            ["ARS", "Pesos"],
            ["MEP", "Dólar MEP"],
            ["BLUE", "Dólar blue"],
          ] as const).map(([option, label]) => (
            <button
              key={option}
              type="button"
              aria-pressed={display === option}
              onClick={() => setDisplay(option)}
              className={cn(
                "h-7 cursor-pointer rounded-md px-3 text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                display === option ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stat(
          "Valor de tenencias",
          formatMoney(totalValue, displayCurrency),
          display === "ARS"
            ? hasUsd ? (mep ? "Tenencias en USD valuadas al MEP · efectivo no incluido" : "Esperando dólar MEP") : "Efectivo no incluido"
            : rate ? `${display === "BLUE" ? "Blue venta" : "MEP"}: ${formatMoney(rate)} por USD · efectivo no incluido` : hasArs ? "Esperando cotización" : "Efectivo no incluido",
        )}
        {stat(
          "Efectivo disponible",
          formatMoney(availableCash, displayCurrency),
          iolConfigured ? undefined : "Solo con IOL",
        )}
        <PortfolioResultCard
          positions={rows.map((row) => ({
            value: row.value,
            currency: row.currency,
            dayChangePct: row.dayChangePct,
            cost: row.cost,
          }))}
          summary={resultSummary}
          display={display}
          rate={rate}
          displayReady={displayReady}
        />
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
                    <th className="px-4 py-2.5 text-right font-medium">PPC ({displayCurrency})</th>
                    <SortHeader k="lastPrice" label={`Último (${displayCurrency})`} sort={sort} onSort={toggleSort} />
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
                        <span className="inline-flex items-center justify-end gap-1.5">
                          {formatNumber(convert(r.avgPrice, r.currency))}
                          {r.origin === "IOL" && (
                            <button
                              type="button"
                              className="rounded p-1 text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={`${r.avgPrice == null ? "Cargar" : "Editar"} precio promedio de compra de ${r.symbol}`}
                              title={`${r.avgPrice == null ? "Cargar" : "Editar"} PPC de ${r.symbol}`}
                              onClick={() => {
                                setEditing(r);
                                setPurchasePrice(r.avgPrice == null ? "" : String(r.avgPrice));
                                setPurchaseError(null);
                              }}
                            >
                              <Pencil className="size-3.5" aria-hidden />
                            </button>
                          )}
                        </span>
                      </td>
                      <td className="num px-4 py-2.5 text-right">{formatNumber(convert(r.lastPrice, r.currency))}</td>
                      <td className="px-4 py-2.5 text-right">
                        <ChangePill pct={r.dayChangePct} />
                      </td>
                      <td className="num px-4 py-2.5 text-right font-medium">{formatMoney(convert(r.value, r.currency), displayCurrency)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {r.pnl != null && convert(r.pnl, r.currency) != null ? (
                          <span className={cn("num flex flex-col items-end", trend(r.pnl) === "up" ? "text-up" : trend(r.pnl) === "down" ? "text-down" : "")}>
                            <span className="text-sm font-medium">
                              {r.pnl > 0 ? "+" : r.pnl < 0 ? "−" : ""}
                              {formatMoney(Math.abs(convert(r.pnl, r.currency) ?? 0), displayCurrency)}
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

        <div className="flex flex-col gap-4 xl:self-start">
          <section className="flex flex-col gap-4 rounded-xl border bg-card p-4" aria-label="Distribución">
            <h2 className="font-medium">Distribución</h2>
            {distribution.length === 0 ? (
              <p className="text-sm text-muted-foreground">{displayReady ? "Sin datos." : "Esperando cotización."}</p>
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
                    <span className="num text-muted-foreground">{formatMoney(d.value, displayCurrency, 0)}</span>
                      <span className="num w-14 text-right font-medium">{formatNumber(d.pct, 1)} %</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
          <section className="flex flex-col gap-4 rounded-xl border bg-card p-4" aria-label="Distribución por instrumento">
            <h2 className="font-medium">Distribución de tenencias</h2>
            {displayReady ? <HoldingsPieChart slices={holdingsDistribution} currency={displayCurrency} /> : (
              <p className="text-sm text-muted-foreground">Esperando cotización.</p>
            )}
          </section>
        </div>
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
      <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={savePurchasePrice} className="grid gap-5">
            <DialogHeader>
              <DialogTitle>Precio promedio de compra · {editing?.symbol}</DialogTitle>
              <DialogDescription>
                Ingresá el PPC por unidad en {editing?.currency === "USD" ? "dólares" : "pesos"}, como figura en IOL. Para bonos, usá el precio por nominal.
                Se guarda solo en este navegador.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="iol-purchase-price">PPC ({editing?.currency})</Label>
              <Input
                id="iol-purchase-price"
                autoFocus
                inputMode="decimal"
                value={purchasePrice}
                onChange={(event) => { setPurchasePrice(event.target.value); setPurchaseError(null); }}
                placeholder="Ej. 1250,50"
                required
              />
              {purchaseError && <p className="text-sm text-destructive" role="alert">{purchaseError}</p>}
            </div>
            <DialogFooter><Button type="submit">Guardar PPC</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
