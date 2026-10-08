import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { AddPositionDialog } from "@/components/portfolio/add-position-dialog";
import { IolConnectionCard, IolResultNotice } from "@/components/portfolio/iol-connection-card";
import { PortfolioScreen } from "@/components/portfolio/portfolio-screen";
import { hasIol } from "@/lib/env";
import { getIolCash, getIolPortfolio, type BrokerCash, type BrokerHolding } from "@/lib/market/iol";
import { verifySession } from "@/server/auth/session";
import { iol } from "@/server/iol";
import { IolError } from "@/server/iol/errors";
import { getMcpPortfolio } from "@/server/iol/portfolio";
import type { IolStatus } from "@/server/iol/session-service";
import { getPositions } from "@/server/queries";

export const metadata: Metadata = { title: "Portafolio" };

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<{ iol?: string }> }) {
  // La página es abierta. La cartera real de IOL se ve solo en el navegador que la conectó (login con IOL).
  const user = await verifySession();
  const { iol: iolResult } = await searchParams;
  const services = iol();

  let broker: BrokerHolding[] = [];
  let cash: BrokerCash[] = [];
  let brokerError: string | null = null;
  let status: IolStatus = { connected: false };

  if (services && user) {
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

  // Integración anterior por usuario y contraseña (variables de entorno), solo si no hay conexión OAuth.
  const legacy = !status.connected && hasIol;
  if (legacy) {
    const [p, c] = await Promise.allSettled([getIolPortfolio(), getIolCash()]);
    if (p.status === "fulfilled") broker = p.value;
    else brokerError = (p.reason as Error).message;
    if (c.status === "fulfilled") cash = c.value;
  }
  const manual = await getPositions();
  const brokerConnected = status.connected || legacy;

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
      {!legacy && <IolConnectionCard status={status} configured={Boolean(services)} />}
      <PortfolioScreen broker={broker} brokerError={brokerError} cash={cash} manual={manual} iolConfigured={brokerConnected} />
    </div>
  );
}
