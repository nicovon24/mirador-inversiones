import { CheckCircle2, Link2Off, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { connectIol, disconnectIol } from "@/server/iol/actions";
import type { IolStatus } from "@/server/iol/session-service";

/** Mensajes del resultado del callback (?iol=...). Ninguno repite datos de IOL. */
const RESULT_MESSAGE: Record<string, { tone: "ok" | "warn"; text: string }> = {
  connected: { tone: "ok", text: "Listo: ya ves tu portafolio de IOL." },
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

/** Tarjeta de Portafolio: el único lugar que pide login, y ese login es el de IOL. */
export function IolConnectionCard({ status, configured }: { status: IolStatus; configured: boolean }) {
  if (status.connected) {
    return (
      <section className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4" aria-label="Conexión con InvertirOnline">
        <ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Portafolio de IOL conectado</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Acceso de solo lectura desde este navegador
            {status.absoluteExpiresAt ? `, hasta el ${formatDate(status.absoluteExpiresAt)} (${status.daysLeft} días)` : ""}. Después
            hay que volver a ingresar con IOL.
          </p>
        </div>
        <form action={disconnectIol}>
          <Button type="submit" variant="outline" size="sm">
            <Link2Off /> Desconectar
          </Button>
        </form>
      </section>
    );
  }

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4" aria-label="Portafolio de InvertirOnline">
      <Lock className="size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Tu portafolio de InvertirOnline</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Ingresás con tu usuario de IOL en la página de IOL: esta app nunca ve tu contraseña y solo puede leer tu cartera y tus
          saldos, nunca operar.
        </p>
      </div>
      {configured ? (
        <form action={connectIol}>
          <input type="hidden" name="returnTo" value="/portfolio" />
          <Button type="submit" size="sm">
            <Lock /> Ver mi portafolio de IOL
          </Button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">
          Falta configurar <code className="font-mono">IOL_SESSION_SECRET</code>.
        </p>
      )}
    </section>
  );
}
