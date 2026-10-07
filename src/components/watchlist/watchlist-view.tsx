"use client";

import { MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChangePill } from "@/components/market/change";
import { Sparkline } from "@/components/market/sparkline";
import { SymbolAvatar } from "@/components/market/symbol-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useHistory, useQuotes } from "@/hooks/use-market";
import { formatCompact, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { addToWatchlist, deleteWatchlist, removeFromWatchlist } from "@/server/actions";
import type { WatchlistView as WL } from "@/server/queries";
import { InstrumentPicker } from "./instrument-picker";
import { NewWatchlistDialog } from "./new-watchlist-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";

function RowSpark({ k }: { k: string }) {
  const { data } = useHistory(k, "1M");
  return <Sparkline values={(data?.candles ?? []).map((c) => c.close)} width={96} height={28} />;
}

export function WatchlistScreen({ lists, activeId }: { lists: WL[]; activeId: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const active = lists.find((l) => l.id === activeId) ?? lists[0] ?? null;
  const { data } = useQuotes(active?.items.map((i) => i.key) ?? []);
  // Algunas fuentes gratuitas no informan máximo/mínimo: en ese caso ocultamos la columna.
  const hasRange = Object.values(data?.quotes ?? {}).some((q) => q.low != null && q.high != null);

  if (!active) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-16 text-center">
        <p className="font-medium">Todavía no tenés listas</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Creá una lista para seguir acciones, CEDEARs y bonos con precios en vivo.
        </p>
        <NewWatchlistDialog trigger={<Button><Plus /> Crear mi primera lista</Button>} />
      </div>
    );
  }

  const remove = (key: string, symbol: string) =>
    start(async () => {
      const res = await removeFromWatchlist({ key, watchlistId: active.id });
      if (res.ok) toast.success(`${symbol} quitado de “${active.name}”`);
      else toast.error(res.error);
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-0.5" role="tablist" aria-label="Listas">
          {lists.map((l) => (
            <Link
              key={l.id}
              href={`/watchlist?list=${l.id}`}
              role="tab"
              aria-selected={l.id === active.id}
              className={cn(
                "flex h-8 items-center gap-2 rounded-md px-3 text-sm transition-colors",
                l.id === active.id ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l.name}
              <span className="num text-[11px] text-muted-foreground">{l.items.length}</span>
            </Link>
          ))}
        </div>
        <NewWatchlistDialog
          trigger={
            <Button variant="ghost" size="sm">
              <Plus /> Nueva lista
            </Button>
          }
        />
        <div className="ml-auto flex items-center gap-2">
          <InstrumentPicker
            onPick={(r) =>
              start(async () => {
                const res = await addToWatchlist({ key: `${r.market}:${r.symbol}`, name: r.name, watchlistId: active.id });
                if (res.ok) toast.success(`${r.symbol} agregado a “${active.name}”`);
                else toast.error(res.error);
              })
            }
          />
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Opciones de la lista" />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setRenaming(true)}>
                <Pencil /> Renombrar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
                <Trash2 /> Eliminar lista
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <NewWatchlistDialog
            key={active.id}
            watchlist={{ id: active.id, name: active.name }}
            open={renaming}
            onOpenChange={setRenaming}
          />
          <ConfirmDialog
            open={deleting}
            onOpenChange={setDeleting}
            title={`¿Eliminar “${active.name}”?`}
            description="Se borra la lista. Los instrumentos siguen en tus otras listas, alertas y portafolio."
            confirmLabel="Eliminar lista"
            pending={pending}
            onConfirm={() =>
              start(async () => {
                const res = await deleteWatchlist(active.id);
                setDeleting(false);
                if (res.ok) {
                  toast.success("Lista eliminada");
                  router.push("/watchlist");
                } else toast.error(res.error);
              })
            }
          />
        </div>
      </div>

      <section className={cn("rounded-xl border bg-card", pending && "opacity-90")}>
        {active.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <p className="font-medium">“{active.name}” está vacía</p>
            <p className="text-sm text-muted-foreground">Usá “Agregar instrumento” o la estrella desde cualquier tabla.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Instrumento</th>
                  <th className="px-4 py-2.5 text-right font-medium">Último</th>
                  <th className="px-4 py-2.5 text-right font-medium">Variación</th>
                  {hasRange && <th className="hidden px-4 py-2.5 text-right font-medium lg:table-cell">Rango del día</th>}
                  <th className="px-4 py-2.5 text-right font-medium">Volumen</th>
                  <th className="px-4 py-2.5 text-right font-medium">1 mes</th>
                  <th className="w-12 px-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {active.items.map((item) => {
                  const q = data?.quotes[item.key];
                  return (
                    <tr key={item.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/instrument/${item.market}/${encodeURIComponent(item.symbol)}`}
                          className="flex items-center gap-3 hover:text-primary"
                        >
                          <SymbolAvatar symbol={item.symbol} market={item.market} />
                          <span className="min-w-0">
                            <span className="block font-medium">{item.symbol}</span>
                            <span className="block max-w-56 truncate text-xs text-muted-foreground">
                              {q?.name ?? item.name ?? "—"}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="num px-4 py-2.5 text-right font-medium">
                        {q ? formatMoney(q.price, q.currency) : <Skeleton className="ml-auto h-4 w-20" />}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <ChangePill pct={q?.changePct} />
                      </td>
                      {hasRange && (
                        <td className="num hidden px-4 py-2.5 text-right text-muted-foreground lg:table-cell">
                          {q?.low && q?.high ? `${formatNumber(q.low)} – ${formatNumber(q.high)}` : "—"}
                        </td>
                      )}
                      <td className="num px-4 py-2.5 text-right text-muted-foreground">{formatCompact(q?.volume)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end">
                          <RowSpark k={item.key} />
                        </div>
                      </td>
                      <td className="px-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Quitar ${item.symbol} de la lista`}
                          onClick={() => remove(item.key, item.symbol)}
                          className="text-muted-foreground/70 hover:text-destructive"
                        >
                          <X />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
