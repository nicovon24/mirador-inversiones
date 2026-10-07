"use client";

import { CheckCircle2, ExternalLink, Send } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { registerTelegramWebhook, sendTelegramTest, unlinkTelegram } from "@/server/actions";

export function TelegramCard({
  configured,
  linked,
  startUrl,
}: {
  configured: boolean;
  linked: boolean;
  startUrl: string | null;
}) {
  const [pending, start] = useTransition();

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) toast.success(ok);
      else toast.error(res.error ?? "Algo falló");
    });

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="font-medium">Alertas por Telegram</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Recibí las alertas de precio en tu celular aunque Mirador esté cerrado.
          </p>
        </div>
        {linked && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-up-soft px-2.5 py-1 text-xs font-medium text-up">
            <CheckCircle2 className="size-3.5" /> Vinculado
          </span>
        )}
      </div>

      {!configured ? (
        <ol className="mt-4 grid list-decimal gap-2 pl-5 text-sm text-foreground/85">
          <li>
            En Telegram hablale a <span className="font-medium">@BotFather</span>, enviá <code className="font-mono text-xs">/newbot</code> y copiá el token.
          </li>
          <li>
            Cargalo como <code className="font-mono text-xs">TELEGRAM_BOT_TOKEN</code> y definí <code className="font-mono text-xs">TELEGRAM_WEBHOOK_SECRET</code> (cualquier texto largo y aleatorio).
          </li>
          <li>Reiniciá la app y volvé a esta pantalla.</li>
        </ol>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {!linked && startUrl && (
            <Button render={<a href={startUrl} target="_blank" rel="noreferrer" />}>
              <ExternalLink /> Vincular Telegram
            </Button>
          )}
          {linked && (
            <Button variant="outline" disabled={pending} onClick={() => act(sendTelegramTest, "Mensaje de prueba enviado")}>
              <Send /> Enviar prueba
            </Button>
          )}
          <Button variant="ghost" disabled={pending} onClick={() => act(registerTelegramWebhook, "Webhook registrado")}>
            Registrar webhook
          </Button>
          {linked && (
            <Button variant="ghost" disabled={pending} onClick={() => act(unlinkTelegram, "Telegram desvinculado")}>
              Desvincular
            </Button>
          )}
        </div>
      )}
      {configured && !linked && (
        <p className="mt-3 text-xs text-muted-foreground">
          Primero registrá el webhook (una vez por deploy), después tocá “Vincular” y enviá <code className="font-mono">/start</code> en el chat.
        </p>
      )}
    </section>
  );
}
