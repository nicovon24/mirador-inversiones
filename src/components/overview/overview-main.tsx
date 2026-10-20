"use client";

import { useState } from "react";
import { ChartPanel } from "@/components/market/chart-panel";
import type { WatchlistView } from "@/server/queries";
import { MarketMovers } from "./market-movers";
import { WatchlistPanel } from "./watchlist-panel";

const FALLBACK_KEY = "US:^GSPC";

export function OverviewMain({ watchlist, watchedKeys, showWatchlist }: { watchlist: WatchlistView | null; watchedKeys: string[]; showWatchlist: boolean }) {
  const [selected, setSelected] = useState<string>(watchlist?.items[0]?.key ?? FALLBACK_KEY);
  const watched = new Set(watchedKeys);

  return (
    <div className={showWatchlist ? "grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]" : "grid grid-cols-1 gap-4"}>
      <div className="flex min-w-0 flex-col gap-4">
        <ChartPanel
          key={selected}
          instrumentKey={selected}
          name={watchlist?.items.find((i) => i.key === selected)?.name}
          watched={watched.has(selected)}
        />
        <MarketMovers />
      </div>
      {showWatchlist && (
        <div className="xl:sticky xl:top-20 xl:self-start">
          <WatchlistPanel watchlist={watchlist} selected={selected} onSelect={setSelected} />
        </div>
      )}
    </div>
  );
}
