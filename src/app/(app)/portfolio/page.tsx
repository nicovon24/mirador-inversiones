import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { AddPositionDialog } from "@/components/portfolio/add-position-dialog";
import { IolConnectionCard, IolResultNotice } from "@/components/portfolio/iol-connection-card";
import { PortfolioScreen } from "@/components/portfolio/portfolio-screen";
import type { BrokerCash, BrokerHolding } from "@/lib/broker-types";
import { requirePrivatePage } from "@/server/private-page";
import { iol } from "@/server/iol";
import { IolError } from "@/server/iol/errors";
import { getMcpPortfolio } from "@/server/iol/portfolio";
import type { IolStatus } from "@/server/iol/session-service";
import { getPositions } from "@/server/queries";

export const metadata: Metadata = { title: "Portafolio" };

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<{ iol?: string }> }) {
  const user = await requirePrivatePage("/portfolio");
  const { iol: iolResult } = await searchParams;
  const services = iol();

  let broker: BrokerHolding[] = [];
  let cash: BrokerCash[] = [];
  let brokerError: string | null = null;
  let status: IolStatus = { connected: false };

  if (services) {
    status = await services.session.status(user.id);
    if (status.connected) {
      // Cartera en vivo vía MCP de solo lectura, con los tokens de este usuario. No se guarda nada.
      try {
        ({ holdings: broker, cash } = await getMcpPortfolio(services.gateway, user.id));
      } catch (e) {
        brokerError = e instanceof IolError ? e.message : "error inesperado. Intentá nuevamente.";
        // Si IOL rechazó la sesión, la conexión ya se borró: se refleja en la tarjeta.
        if (e instanceof IolError && !e.temporary) status = await services.session.status(user.id);
      }
    }
  }

  const manual = await getPositions();
  const brokerConnected = status.connected;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Portafolio"
        description={
          brokerConnected
            ? "Tus tenencias de InvertirOnline más las posiciones que cargues a mano."
            : "Tus posiciones valuadas con precios en vivo."
        }
        actions={<AddPositionDialog />}
      />
      <IolResultNotice result={iolResult} />
      <IolConnectionCard status={status} configured={Boolean(services)} />
      <PortfolioScreen broker={broker} brokerError={brokerError} cash={cash} manual={manual} iolConfigured={brokerConnected} costBasisOwner={user.id} />
    </div>
  );
}
