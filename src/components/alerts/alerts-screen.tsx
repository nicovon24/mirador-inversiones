"use client";

import { BellOff, BellRing, Pause, Play, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SymbolAvatar } from "@/components/market/symbol-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InstrumentPicker } from "@/components/watchlist/instrument-picker";
import { useQuotes } from "@/hooks/use-market";
import { describeRule, distanceToTarget } from "@/lib/alerts";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import type { SearchResult } from "@/lib/market/types";
import { cn } from "@/lib/utils";
import { deleteAlert, setAlertStatus } from "@/server/actions";
import type { AlertView } from "@/server/queries";
import { CreateAlertDialog } from "./create-alert-dialog";

const STATUS: Record<AlertView["status"], { label: string; className: string }> = {
  ACTIVE: { label: "Activa", className: "bg-accent text-accent-foreground" },
  TRIGGERED: { label: "Disparada", className: "bg-up-soft text-up" },
  PAUSED: { label: "Pausada", className: "bg-muted text-muted-foreground" },
};

function NewAlert({ picked, onClose }: { picked: SearchResult; onClose: () => void }) {
  const key = `${picked.market}:${picked.symbol}`;
  const { data } = useQuotes([key]);
  return (
    <CreateAlertDialog
      open
      onOpenChange={(o) => !o && onClose()}
      instrumentKey={key}
      symbol={picked.symbol}
      name={picked.name}
      price={data?.quotes[key]?.price}
    />
  );
}

export function AlertsScreen({ alerts, telegramLinked }: { alerts: AlertView[]; telegramLinked: boolean }) {
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [toDelete, setToDelete] = useState<AlertView | null>(null);
  const [pending, start] = useTransition();
  const { data } = useQuotes(alerts.map((a) => a.key));

  const counts = {
    ACTIVE: alerts.filter((a) => a.status === "ACTIVE").length,
    TRIGGERED: alerts.filter((a) => a.status === "TRIGGERED").length,
  };

  const toggle = (a: AlertView) =>
    start(async () => {
      const next = a.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
      const res = await setAlertStatus(a.id, next);
      if (res.ok) toast.success(next === "ACTIVE" ? "Alerta reactivada" : "Alerta pausada");
      else toast.error(res.error);
    });

  return (
    <div className="flex flex-col gap-4">
      {!telegramLinked && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/25 bg-accent/50 px-4 py-3 text-sm">
          <BellRing className="size-4 text-primary" aria-hidden />
          <p className="flex-1">
            Vinculá Telegram para recibir las alertas aunque tengas la app cerrada.
          </p>
          <Button variant="outline" size="sm" render={<Link href="/settings" />}>
            Vincular Telegram
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="num font-medium text-foreground">{counts.ACTIVE}</span> activas ·{" "}
          <span className="num font-medium text-foreground">{counts.TRIGGERED}</span> disparadas
        </p>
        <div className="ml-auto">
          <InstrumentPicker label="Nueva alerta" onPick={setPicked} />
        </div>
      </div>

      <section className="rounded-xl border bg-card">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <BellOff className="size-6 text-muted-foreground" aria-hidden />
            <p className="font-medium">No tenés alertas todavía</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Elegí un instrumento y te avisamos cuando llegue al precio que te interesa.
            </p>
            <InstrumentPicker
              onPick={setPicked}
              trigger={
                <Button>
                  <Plus /> Crear mi primera alerta
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Instrumento</th>
                  <th className="px-4 py-2.5 font-medium">Condición</th>
                  <th className="px-4 py-2.5 text-right font-medium">Precio actual</th>
                  <th className="px-4 py-2.5 text-right font-medium">Distancia</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="w-24 px-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {alerts.map((a) => {
                  const q = data?.quotes[a.key];
                  const dist = q ? distanceToTarget(a, q.price) : null;
                  return (
                    <tr key={a.id} className={cn("transition-colors hover:bg-muted/40", a.status === "PAUSED" && "opacity-60")}>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/instrument/${a.market}/${encodeURIComponent(a.symbol)}`}
                          className="flex items-center gap-3 hover:text-primary"
                        >
                          <SymbolAvatar symbol={a.symbol} market={a.market} />
                          <span className="min-w-0">
                            <span className="block font-medium">{a.symbol}</span>
                            <span className="block max-w-48 truncate text-xs text-muted-foreground">
                              {a.note ?? a.name ?? `Creada el ${formatDate(a.createdAt)}`}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="num px-4 py-2.5">
                        {describeRule(a, (n) => formatNumber(n))}
                        {a.repeat && <span className="ml-2 text-xs text-muted-foreground">· se repite</span>}
                      </td>
                      <td className="num px-4 py-2.5 text-right font-medium">
                        {q ? formatMoney(q.price, q.currency) : <Skeleton className="ml-auto h-4 w-20" />}
                      </td>
                      <td className="num px-4 py-2.5 text-right text-muted-foreground">
                        {a.status === "TRIGGERED" && a.triggeredAt
                          ? formatDate(a.triggeredAt)
                          : dist != null
                            ? a.condition === "PCT_CHANGE"
                              ? `${formatPercent(dist)} de ±${formatNumber(Number(a.target))} %`
                              : formatPercent(dist)
                            : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge className={cn("border-0", STATUS[a.status].className)}>{STATUS[a.status].label}</Badge>
                      </td>
                      <td className="px-2">
                        <div className="flex justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={pending}
                            onClick={() => toggle(a)}
                            aria-label={a.status === "ACTIVE" ? `Pausar alerta de ${a.symbol}` : `Reactivar alerta de ${a.symbol}`}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {a.status === "ACTIVE" ? <Pause /> : <Play />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setToDelete(a)}
                            aria-label={`Eliminar alerta de ${a.symbol}`}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {picked && <NewAlert picked={picked} onClose={() => setPicked(null)} />}
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`¿Eliminar la alerta de ${toDelete?.symbol ?? ""}?`}
        description="No vas a recibir más avisos de esta alerta."
        confirmLabel="Eliminar alerta"
        pending={pending}
        onConfirm={() =>
          start(async () => {
            if (!toDelete) return;
            const res = await deleteAlert(toDelete.id);
            setToDelete(null);
            if (res.ok) toast.success("Alerta eliminada");
            else toast.error(res.error);
          })
        }
      />
    </div>
  );
}
