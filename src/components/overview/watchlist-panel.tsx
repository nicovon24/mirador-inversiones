"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { ChangePill } from "@/components/market/change";
import { SymbolAvatar } from "@/components/market/symbol-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuotes } from "@/hooks/use-market";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WatchlistView } from "@/server/queries";

export function WatchlistPanel({
  watchlist,
  selected,
  onSelect,
}: {
  watchlist: WatchlistView | null;
  selected: string;
  onSelect: (key: string) => void;
}) {
  const items = watchlist?.items ?? [];
  const { data } = useQuotes(items.map((i) => i.key));

  return (
    <section className="flex flex-col rounded-xl border bg-card" aria-label="Tu watchlist">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <h2 className="font-medium">Tu watchlist</h2>
          <p className="text-xs text-muted-foreground">
            {watchlist?.name ?? "Sin lista"} · {items.length} {items.length === 1 ? "instrumento" : "instrumentos"}
          </p>
        </div>
        <Link
          href="/watchlist"
          aria-label="Administrar listas"
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus className="size-4" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <p className="text-sm font-medium">Tu lista está vacía</p>
          <p className="text-xs text-muted-foreground">
            Buscá un ticker con <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">Ctrl K</kbd> y marcalo con la estrella.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-y bg-muted/40 px-4 py-2 text-[11px] font-medium text-muted-foreground">
            <span>Instrumento</span>
            <span className="text-right">Precio</span>
            <span className="w-[4.5rem] text-right">Var.</span>
          </div>
          <ul className="max-h-[520px] divide-y overflow-y-auto">
            {items.map((item) => {
              const q = data?.quotes[item.key];
              const active = item.key === selected;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.key)}
                    aria-current={active || undefined}
                    className={cn(
                      "grid w-full cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2.5 text-left transition-colors focus-visible:bg-muted focus-visible:outline-none",
                      active ? "bg-accent/70" : "hover:bg-muted/60",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <SymbolAvatar symbol={item.symbol} market={item.market} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{item.symbol}</span>
                        <span className="block truncate text-xs text-muted-foreground">{q?.name ?? item.name ?? "—"}</span>
                      </span>
                    </span>
                    <span className="num text-right text-sm font-medium">
                      {q ? formatMoney(q.price, q.currency) : <Skeleton className="h-4 w-16" />}
                    </span>
                    <ChangePill pct={q?.changePct} />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
