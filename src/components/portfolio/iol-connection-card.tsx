import { CheckCircle2, Link2, Link2Off, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { connectIol, disconnectIol } from "@/server/iol/actions";
import type { IolStatus } from "@/server/iol/session-service";

/** Mensajes del resultado del callback (?iol=...). Ninguno repite datos de IOL. */
const RESULT_MESSAGE: Record<string, { tone: "ok" | "warn"; text: string }> = {
  connected: { tone: "ok", text: "Tu cuenta de IOL quedó conectada." },
  denied: { tone: "warn", text: "No se conectó IOL: cancelaste o rechazaste el permiso." },
  expired: { tone: "warn", text: "El pedido de conexión venció. Volvé a intentarlo." },
  invalid: { tone: "warn", text: "El pedido de conexión no es válido o ya se usó. Volvé a intentarlo desde esta pantalla." },
  unavailable: { tone: "warn", text: "IOL no respondió. Probá de nuevo en unos minutos." },
  error: { tone: "warn", text: "No se pudo completar la conexión con IOL." },
  not_configured: { tone: "warn", text: "Falta configurar IOL_SESSION_SECRET en el servidor." },
};

export function IolResultNotice({ result }: { result?: string }) {
  const msg = result ? RESULT_MESSAGE[result] : undefined;
  if (!msg) return null;
  return (
    <p
      role="status"
      className={
        msg.tone === "ok"
          ? "flex items-center gap-2 rounded-xl border border-up/30 bg-up-soft px-4 py-3 text-sm text-up"
          : "rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
      }
    >
      {msg.tone === "ok" && <CheckCircle2 className="size-4" aria-hidden />}
      {msg.text}
    </p>
  );
}

export function IolConnectionCard({
  status,
  configured,
  returnTo = "/portfolio",
}: {
  status: IolStatus;
  configured: boolean;
  returnTo?: "/portfolio" | "/settings";
}) {
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4" aria-label="Conexión con InvertirOnline">
      <ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{status.connected ? "IOL conectado" : "Conectá tu cuenta de InvertirOnline"}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {status.connected && status.absoluteExpiresAt
            ? `Acceso de solo lectura. Vence el ${formatDate(status.absoluteExpiresAt)} (${status.daysLeft} días): después hay que autorizar de nuevo.`
            : "Iniciás sesión en IOL y das el permiso allá: esta app nunca ve tu contraseña y solo puede leer tu cartera y tus saldos, nunca operar."}
        </p>
      </div>
      {!configured ? (
        <p className="text-xs text-muted-foreground">
          Falta configurar <code className="font-mono">IOL_SESSION_SECRET</code>.
        </p>
      ) : status.connected ? (
        <form action={disconnectIol}>
          <Button type="submit" variant="outline" size="sm">
            <Link2Off /> Desconectar
          </Button>
        </form>
      ) : (
        <form action={connectIol}>
          <input type="hidden" name="returnTo" value={returnTo} />
          <Button type="submit" size="sm">
            <Link2 /> Conectar IOL
          </Button>
        </form>
      )}
    </section>
  );
}
