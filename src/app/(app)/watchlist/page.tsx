import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { WatchlistScreen } from "@/components/watchlist/watchlist-view";
import { getWatchlists } from "@/server/queries";

export const metadata: Metadata = { title: "Watchlist" };

export default async function WatchlistPage({ searchParams }: PageProps<"/watchlist">) {
  const { list } = await searchParams;
  const lists = await getWatchlists();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Watchlist" description="Tus listas con precios en vivo de Argentina y EE.UU." live />
      <WatchlistScreen lists={lists} activeId={typeof list === "string" ? list : null} />
    </div>
  );
}
