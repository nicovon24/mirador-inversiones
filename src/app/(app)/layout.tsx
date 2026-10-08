import { connection } from "next/server";
import { Sidebar } from "@/components/shell/sidebar";
import { StatusFooter, type SourceStatus } from "@/components/shell/status-footer";
import { Topbar } from "@/components/shell/topbar";
import { hasDatabase, hasFinnhub, hasIol } from "@/lib/env";
import { requireUser } from "@/server/auth/session";
import { getActiveAlertCount, getNotifications, getWatchlists } from "@/server/queries";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Todo el espacio lee datos vivos (base y proveedores): nunca se prerenderiza.
  await connection();
  // Verificación real de la sesión (proxy.ts solo mira que exista la cookie).
  await requireUser();
  const [watchlists, alertCount, notifications] = await Promise.all([
    getWatchlists(),
    getActiveAlertCount(),
    getNotifications(),
  ]);

  const sidebar = {
    watchlists: watchlists.map((w) => ({ id: w.id, name: w.name, count: w.items.length })),
    alertCount,
  };

  const sources: SourceStatus[] = [
    hasIol
      ? { label: "IOL", live: true, detail: "Argentina en tiempo real" }
      : { label: "data912", live: false, detail: "Argentina, puede tener demora" },
    hasFinnhub
      ? { label: "Finnhub", live: true, detail: "EE.UU. en tiempo real" }
      : { label: "data912 · Yahoo", live: false, detail: "EE.UU., puede tener demora" },
    ...(!hasDatabase ? [{ label: "Base de datos", live: false, detail: "sin configurar" }] : []),
  ];

  return (
    <div className="flex min-h-dvh">
      <Sidebar {...sidebar} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar sidebar={sidebar} notifications={notifications} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        <StatusFooter sources={sources} />
      </div>
    </div>
  );
}
