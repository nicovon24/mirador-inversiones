import { MarketCards } from "@/components/overview/market-cards";
import { OverviewMain } from "@/components/overview/overview-main";
import { PageHeader } from "@/components/page-header";
import { getOverviewCards } from "@/lib/market";
import { getWatchlists } from "@/server/queries";

export default async function OverviewPage() {
  const [cards, watchlists] = await Promise.all([getOverviewCards(), getWatchlists()]);
  const watchedKeys = [...new Set(watchlists.flatMap((w) => w.items.map((i) => i.key)))];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Resumen del mercado" description="Argentina y EE.UU. de un vistazo, con tus instrumentos al lado." live />
      <MarketCards initial={cards} />
      <OverviewMain watchlist={watchlists[0] ?? null} watchedKeys={watchedKeys} />
    </div>
  );
}
