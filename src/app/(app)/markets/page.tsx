import type { Metadata } from "next";
import { MarketsTable } from "@/components/markets/markets-table";
import { PageHeader } from "@/components/page-header";
import { getWatchlists } from "@/server/queries";

export const metadata: Metadata = { title: "Mercados" };

export default async function MarketsPage() {
  const watchlists = await getWatchlists();
  const watchedKeys = [...new Set(watchlists.flatMap((w) => w.items.map((i) => i.key)))];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Mercados"
        description="Paneles completos de BYMA y EE.UU. Ordená por columna, filtrá y marcá favoritos."
        live
      />
      <MarketsTable watchedKeys={watchedKeys} />
    </div>
  );
}
