"use client";

import { useState } from "react";
import { formatMoney, formatPercent, trend } from "@/lib/format";
import type { PortfolioCurrency } from "@/lib/portfolio-currency";
import type { PortfolioSummary } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

type Period = "day" | "total";

interface ResultPosition {
  value: number;
  currency: "ARS" | "USD";
  dayChangePct: number | null;
  cost: number | null;
}

export function PortfolioResultCard({
  positions,
  summary,
  display,
  rate,
  displayReady,
}: {
  positions: ResultPosition[];
  summary: PortfolioSummary;
  display: PortfolioCurrency;
  rate: number | null;
  displayReady: boolean;
}) {
  const [period, setPeriod] = useState<Period>("day");
  const invested = positions.filter((position) => position.value > 0);
  const covered = invested.filter((position) => period === "day" ? position.dayChangePct != null : position.cost != null).length;
  const resultArs = period === "day" ? summary.dayPnlArs : summary.pnlArs;
  const amount = displayReady && covered > 0 && resultArs != null
    ? display === "ARS" ? resultArs : resultArs / (rate ?? 1)
    : null;
  const pct = period === "day"
    ? resultArs != null && summary.totalArs - resultArs > 0 ? (resultArs / (summary.totalArs - resultArs)) * 100 : null
    : summary.pnlPct;
  const shownPct = amount == null ? null : pct;
  const currency = display === "ARS" ? "ARS" : "USD";
  const usesConversion = positions.some((position) => display === "ARS" ? position.currency === "USD" : position.currency === "ARS");

  let note: string;
  if (!displayReady) note = "Esperando la cotización para convertir la cartera completa.";
  else if (covered === 0) note = period === "day" ? "No hay variación diaria disponible." : "Cargá el PPC de tus tenencias IOL con el lápiz en la tabla para ver el acumulado.";
  else if (covered < invested.length) note = `Resultado parcial: ${covered} de ${invested.length} tenencias con datos.`;
  else note = period === "day" ? "Variación de la rueda actual." : "Acumulado desde el precio de compra.";

  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 sm:col-span-2 xl:col-span-2" aria-label="Resultado del portafolio">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Resultado</h2>
        <div className="flex gap-0.5 rounded-lg bg-muted p-0.5" role="group" aria-label="Período del resultado">
          {(["day", "total"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={period === option}
              onClick={() => setPeriod(option)}
              className={cn(
                "h-7 cursor-pointer rounded-md px-3 text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                period === option ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option === "day" ? "Día" : "Total"}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{period === "day" ? "Resultado del día" : "Resultado desde la compra"}</p>
        <div className={cn("num mt-1 text-2xl font-semibold tracking-tight", trend(amount) === "up" && "text-up", trend(amount) === "down" && "text-down")}>
          {amount == null ? "—" : `${amount > 0 ? "+" : amount < 0 ? "−" : ""}${formatMoney(Math.abs(amount), currency)}`}
        </div>
        <p className={cn("num mt-1 text-sm", trend(shownPct) === "up" && "text-up", trend(shownPct) === "down" && "text-down", shownPct == null && "text-muted-foreground")}>
          {formatPercent(shownPct)}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">{note}</p>
      {usesConversion && <p className="text-xs text-muted-foreground">Conversión al tipo de cambio actual; el resultado no incluye cambios del dólar.</p>}
    </section>
  );
}
