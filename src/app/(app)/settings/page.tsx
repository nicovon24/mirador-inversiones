import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { TelegramCard } from "@/components/settings/telegram-card";
import { ThemePicker } from "@/components/settings/theme-picker";
import { hasDatabase, hasFinnhub, hasIol } from "@/lib/env";
import { getBotUsername, hasTelegram, linkCode } from "@/lib/telegram";
import { getSettings } from "@/server/queries";

export const metadata: Metadata = { title: "Ajustes" };

const SOURCES = [
  { name: "InvertirOnline", env: "IOL_USERNAME · IOL_PASSWORD", on: () => hasIol, what: "Argentina en tiempo real y tu portafolio" },
  { name: "Finnhub", env: "FINNHUB_API_KEY", on: () => hasFinnhub, what: "EE.UU. en tiempo real y ratios" },
  { name: "data912", env: "sin clave", on: () => true, what: "Respaldo gratuito: paneles BYMA, EE.UU., MEP y CCL" },
  { name: "Yahoo Finance", env: "sin clave", on: () => true, what: "Índices y velas de EE.UU." },
  { name: "Postgres", env: "DATABASE_URL", on: () => hasDatabase, what: "Listas, alertas y posiciones" },
];

export default async function SettingsPage() {
  const settings = await getSettings();
  const configured = hasTelegram();
  const username = configured ? await getBotUsername().catch(() => null) : null;
  const startUrl = username ? `https://t.me/${username}?start=${linkCode()}` : null;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title="Ajustes" description="Apariencia, notificaciones y fuentes de datos." />

      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-medium">Apariencia</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">Elegí el tema o seguí el de tu sistema.</p>
        <ThemePicker />
      </section>

      <TelegramCard configured={configured} linked={Boolean(settings.telegramChatId)} startUrl={startUrl} />

      <section className="rounded-xl border bg-card">
        <div className="p-5 pb-3">
          <h2 className="font-medium">Fuentes de datos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Las claves viven solo en el servidor; nunca llegan al navegador.
          </p>
        </div>
        <ul className="divide-y border-t">
          {SOURCES.map((s) => {
            const on = s.on();
            return (
              <li key={s.name} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <span className={on ? "size-2 rounded-full bg-up" : "size-2 rounded-full bg-muted-foreground/40"} aria-hidden />
                <span className="w-32 font-medium">{s.name}</span>
                <span className="flex-1 text-muted-foreground">{s.what}</span>
                <span className="text-xs text-muted-foreground">
                  {on ? "Activa" : <>Falta <code className="font-mono">{s.env}</code></>}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
