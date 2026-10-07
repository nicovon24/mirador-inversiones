import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { AddPositionDialog } from "@/components/portfolio/add-position-dialog";
import { PortfolioScreen } from "@/components/portfolio/portfolio-screen";
import { hasIol } from "@/lib/env";
import { getIolCash, getIolPortfolio, type BrokerCash, type BrokerHolding } from "@/lib/market/iol";
import { getPositions } from "@/server/queries";

export const metadata: Metadata = { title: "Portafolio" };

export default async function PortfolioPage() {
  let broker: BrokerHolding[] = [];
  let cash: BrokerCash[] = [];
  let brokerError: string | null = null;

  if (hasIol) {
    const [p, c] = await Promise.allSettled([getIolPortfolio(), getIolCash()]);
    if (p.status === "fulfilled") broker = p.value;
    else brokerError = (p.reason as Error).message;
    if (c.status === "fulfilled") cash = c.value;
  }
  const manual = await getPositions();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Portafolio"
        description={hasIol ? "Tus tenencias de InvertirOnline más las posiciones que cargues a mano." : "Tus posiciones valuadas con precios en vivo."}
        actions={<AddPositionDialog />}
      />
      <PortfolioScreen broker={broker} brokerError={brokerError} cash={cash} manual={manual} iolConfigured={hasIol} />
    </div>
  );
}
