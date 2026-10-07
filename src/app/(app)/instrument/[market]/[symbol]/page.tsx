import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HelpTip } from "@/components/help/help-tip";
import { BondSheet } from "@/components/instrument/bond-sheet";
import { CedearSheet } from "@/components/instrument/cedear-sheet";
import { ChartPanel } from "@/components/market/chart-panel";
import { hasFinnhub } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { finnhubMetrics } from "@/lib/market/finnhub";
import { getAlerts, getWatchlists } from "@/server/queries";
import { resolveFundamentalsAsync } from "@/server/research";
import { describeRule } from "@/lib/alerts";
import { findBond } from "@/lib/bonds";
import { CEDEAR_RATIOS } from "@/lib/cedears";
import { instrumentInfo } from "@/lib/instrument-info";
import Link from "next/link";

type Params = { market: string; symbol: string };

function parse(params: Params) {
  const market = params.market.toUpperCase();
  if (market !== "AR" && market !== "US") return null;
  return { market: market as "AR" | "US", symbol: decodeURIComponent(params.symbol).toUpperCase() };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = parse(await params);
  return { title: p ? p.symbol.replace(/^\^/, "") : "Instrumento" };
}

const METRICS: { key: string; label: string; help?: string; digits?: number; suffix?: string }[] = [
  { key: "52WeekHigh", label: "Máximo 52 semanas", help: "maximo-minimo" },
  { key: "52WeekLow", label: "Mínimo 52 semanas", help: "maximo-minimo" },
  { key: "peTTM", label: "P/E (12 meses)", help: "per" },
  { key: "epsTTM", label: "EPS (12 meses)", help: "eps" },
  { key: "beta", label: "Beta", help: "beta" },
  { key: "dividendYieldIndicatedAnnual", label: "Rendimiento por dividendo", help: "dividend-yield", suffix: " %" },
  { key: "marketCapitalization", label: "Capitalización (millones USD)", help: "market-cap", digits: 0 },
  { key: "netProfitMarginTTM", label: "Margen neto", suffix: " %" },
];

export default async function InstrumentPage({ params }: { params: Promise<Params> }) {
  const p = parse(await params);
  if (!p) notFound();
  const key = `${p.market}:${p.symbol}`;

  const [watchlists, alerts, metrics] = await Promise.all([
    getWatchlists(),
    getAlerts(),
    p.market === "US" && hasFinnhub && !p.symbol.startsWith("^") ? finnhubMetrics(p.symbol).catch(() => null) : null,
  ]);
  const item = watchlists.flatMap((w) => w.items).find((i) => i.key === key);
  const myAlerts = alerts.filter((a) => a.key === key);
  const info = instrumentInfo(p.market, p.symbol);
  const hasFundamentals = Boolean(await resolveFundamentalsAsync(p.market, p.symbol));
  const bond = p.market === "AR" ? findBond(p.symbol) : undefined;
  const cedearBase = CEDEAR_RATIOS[p.symbol.replace(/[CD]$/, "")] ? p.symbol.replace(/[CD]$/, "") : p.symbol;
  const cedearSymbol = p.market === "AR" && CEDEAR_RATIOS[cedearBase] ? cedearBase : null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <ChartPanel instrumentKey={key} name={item?.name} watched={Boolean(item)} showLink={false} height={420} />
      </div>

      <aside className="flex flex-col gap-4">
        <section className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase">{info.kind}</p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">{info.what}</p>
          <dl className="mt-3 grid gap-2.5 text-[13px] leading-relaxed">
            <div>
              <dt className="font-medium">Quién lo emite</dt>
              <dd className="text-muted-foreground">{info.issuer}</dd>
            </div>
            <div>
              <dt className="font-medium">En qué moneda</dt>
              <dd className="text-muted-foreground">{info.currency}</dd>
            </div>
            <div>
              <dt className="font-medium">De qué depende su precio</dt>
              <dd className="text-muted-foreground">{info.drivers}</dd>
            </div>
            <div>
              <dt className="font-medium">Riesgos</dt>
              <dd className="text-muted-foreground">{info.risks}</dd>
            </div>
          </dl>
          {info.guide && (
            <Link href={`/learn/${info.guide.slug}`} className="mt-3 inline-block text-xs font-medium text-primary hover:underline">
              {info.guide.label}
            </Link>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">Explicación general, no una recomendación de inversión.</p>
        </section>

        {hasFundamentals && (
          <Link
            href={`/research?s=${p.market}:${encodeURIComponent(p.symbol)}`}
            className="rounded-xl border bg-card p-4 text-sm font-medium text-primary transition-colors hover:border-primary/50"
          >
            Ver datos fundamentales y comparables →
          </Link>
        )}

        {bond && <BondSheet bond={bond} />}
        {cedearSymbol && <CedearSheet symbol={cedearSymbol} />}

        {metrics && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 font-medium">Ratios</h2>
            <dl className="grid gap-2.5 text-sm">
              {METRICS.map((m) => {
                const v = metrics[m.key];
                return (
                  <div key={m.key} className="flex justify-between gap-3">
                    <dt className="flex items-center gap-1 text-muted-foreground">
                      {m.label}
                      {m.help && <HelpTip id={m.help} />}
                    </dt>
                    <dd className="num font-medium">
                      {typeof v === "number" ? `${formatNumber(v, m.digits ?? 2)}${m.suffix ?? ""}` : "—"}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p className="mt-3 text-[11px] text-muted-foreground">Fuente: Finnhub</p>
          </section>
        )}

        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 font-medium">Tus alertas</h2>
          {myAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin alertas. Creá una desde el menú “···” del gráfico.</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {myAlerts.map((a) => (
                <li key={a.id} className="num flex justify-between gap-3">
                  <span>{describeRule(a, (n) => formatNumber(n))}</span>
                  <span className="text-muted-foreground">
                    {a.status === "ACTIVE" ? "Activa" : a.status === "PAUSED" ? "Pausada" : "Disparada"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
