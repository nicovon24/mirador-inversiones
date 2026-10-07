"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Change } from "@/components/market/change";
import { Sparkline } from "@/components/market/sparkline";
import { Skeleton } from "@/components/ui/skeleton";
import { useHistory, useOverviewCards } from "@/hooks/use-market";
import { formatNumber } from "@/lib/format";
import type { MarketCard } from "@/lib/market";
import { cn } from "@/lib/utils";

function CardSpark({ href }: { href?: string }) {
  // href = /instrument/US/%5EGSPC → clave US:^GSPC
  const key = href ? href.split("/").slice(2, 4).map(decodeURIComponent).join(":") : null;
  const { data } = useHistory(key, "1D");
  if (!key) return null;
  return <Sparkline values={(data?.candles ?? []).map((c) => c.close)} width={72} height={30} className="shrink-0" />;
}

function Value({ card }: { card: MarketCard }) {
  const q = card.quote;
  if (!q) return <p className="text-sm text-muted-foreground">Sin datos</p>;
  if (card.unit === "bps") return <p className="num text-2xl font-semibold tracking-tight">{formatNumber(q.price, 0)} <span className="text-sm font-normal text-muted-foreground">pb</span></p>;
  if (card.unit === "ARS") return <p className="num text-2xl font-semibold tracking-tight"><span className="text-base font-normal text-muted-foreground">$ </span>{formatNumber(q.price)}</p>;
  return <p className="num text-2xl font-semibold tracking-tight">{formatNumber(q.price)}</p>;
}

export function MarketCards({ initial }: { initial: MarketCard[] }) {
  const { data } = useOverviewCards(initial);
  const cards = data?.cards ?? initial;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 min-[1760px]:grid-cols-6">
      {cards.map((card) => {
        const inner = (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{card.label}</p>
              {card.href && (
                <ArrowUpRight className="size-3.5 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden />
              )}
            </div>
            <div className="flex items-end justify-between gap-3">
              <Value card={card} />
              {card.href && <CardSpark href={card.href} />}
            </div>
            {card.quote && card.unit !== "bps" ? (
              <Change change={card.quote.change} pct={card.quote.changePct} />
            ) : card.quote ? (
              <span className="text-xs text-muted-foreground">Último dato diario</span>
            ) : null}
          </>
        );
        const className = cn(
          "group flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors",
          card.href && "hover:border-ring/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        );
        return card.href ? (
          <Link key={card.id} href={card.href} className={className}>
            {inner}
          </Link>
        ) : (
          <div key={card.id} className={className}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

export function MarketCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 min-[1760px]:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[118px] rounded-xl" />
      ))}
    </div>
  );
}
