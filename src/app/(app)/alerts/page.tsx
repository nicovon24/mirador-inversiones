import type { Metadata } from "next";
import { AlertsScreen } from "@/components/alerts/alerts-screen";
import { PageHeader } from "@/components/page-header";
import { getAlerts, getSettings } from "@/server/queries";

export const metadata: Metadata = { title: "Alertas de precio" };

export default async function AlertsPage() {
  const [alerts, settings] = await Promise.all([getAlerts(), getSettings()]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Alertas de precio"
        description="Te avisamos en la app y por Telegram cuando un instrumento llega a tu precio."
      />
      <AlertsScreen alerts={alerts} telegramLinked={Boolean(settings.telegramChatId)} />
    </div>
  );
}
