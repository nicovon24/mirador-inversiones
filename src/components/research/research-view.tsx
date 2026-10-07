import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { HelpTip } from "@/components/help/help-tip";
import { formatDate, formatNumber, formatPercent, formatTime } from "@/lib/format";
import { compareSentence, PEER_METRICS, RESEARCH_GROUPS } from "@/lib/research";
import { formatMetric } from "@/lib/research-format";
import { cn } from "@/lib/utils";
import type { Research } from "@/server/research";

const SOURCE_NOTE: Record<Research["source"], (s: string) => string> = {
  direct: () => "",
  cedear: (s) => `Datos de la acción original (${s}) en EE.UU. Los ratios son los mismos para el CEDEAR.`,
  adr: (s) =>
    `Datos del ADR ${s} en Nueva York. Los ratios de la empresa son los mismos que en BYMA, pero los balances en pesos están afectados por la inflación: los crecimientos pueden verse inflados.`,
};

function AnalystsBar({ a }: { a: NonNullable<Research["analysts"]> }) {
  const parts = [
    { label: "Compra fuerte", n: a.strongBuy, cls: "bg-up" },
    { label: "Compra", n: a.buy, cls: "bg-up/60" },
    { label: "Mantener", n: a.hold, cls: "bg-muted-foreground/40" },
    { label: "Venta", n: a.sell, cls: "bg-down/60" },
    { label: "Venta fuerte", n: a.strongSell, cls: "bg-down" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label="Distribución de recomendaciones">
        {parts.map((p) => p.n > 0 && <span key={p.label} className={p.cls} style={{ width: `${(p.n / a.total) * 100}%` }} />)}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-5">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", p.cls)} aria-hidden />
            <span className="text-muted-foreground">{p.label}</span>
            <span className="num ml-auto font-medium sm:ml-0">{p.n}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        {a.total} analistas · {formatDate(`${a.period}T12:00:00Z`)}. Es una opinión del mercado, no una recomendación de esta app.
      </p>
    </div>
  );
}

export function ResearchView({ data }: { data: Research }) {
  const note = SOURCE_NOTE[data.source](data.fundamentalsSymbol);
  const p = data.profile;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-card p-5">
        <div className="flex min-w-0 items-center gap-3">
          {p?.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.logo} alt="" className="size-10 rounded-lg border bg-white object-contain p-1" />
          )}
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{p?.name ?? data.fundamentalsSymbol}</h2>
            <p className="text-xs text-muted-foreground">
              {[p?.finnhubIndustry, p?.exchange, p?.country].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        {p?.weburl && (
          <a
            href={p.weburl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Sitio de la empresa <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
        {note && (
          <p className="w-full rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {note}{" "}
            <span className="inline-flex translate-y-0.5">
              <HelpTip id={data.source === "adr" ? "adr" : "cedear"} />
            </span>
          </p>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {RESEARCH_GROUPS.map((g) => {
          const metrics = g.metrics.filter((m) => !(m.perShare && data.source === "adr"));
          return (
            <section key={g.id} className="flex flex-col rounded-xl border bg-card p-4">
              <h3 className="font-medium">{g.title}</h3>
              <p className="mb-3 text-xs text-muted-foreground">{g.description}</p>
              <dl className="grid gap-2.5 text-sm">
                {metrics.map((m) => {
                  const value = data.metrics[m.key] ?? null;
                  const sentence = m.compare ? compareSentence(value, data.peerMedians[m.key] ?? null) : null;
                  return (
                    <div key={m.key}>
                      <div className="flex justify-between gap-3">
                        <dt className="flex items-center gap-1 text-muted-foreground">
                          {m.label}
                          {m.help && <HelpTip id={m.help} />}
                        </dt>
                        <dd className="num text-right font-medium">{formatMetric(value, m)}</dd>
                      </div>
                      {sentence && (
                        <p className="text-right text-[11px] text-muted-foreground">
                          {sentence} ({formatMetric(data.peerMedians[m.key] ?? null, m)})
                        </p>
                      )}
                    </div>
                  );
                })}
              </dl>
            </section>
          );
        })}
      </div>

      {data.peers.length > 0 && (
        <section className="rounded-xl border bg-card">
          <div className="flex items-center gap-1 p-4 pb-2">
            <h3 className="font-medium">Comparables</h3>
            <HelpTip id="comparables" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Empresa</th>
                  {PEER_METRICS.map((m) => (
                    <th key={m.key} className="px-4 py-2.5 text-right font-medium">
                      {m.label.replace(", últimos 12 meses vs. año anterior", " (12 m)")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr className="bg-primary/5 font-medium">
                  <td className="px-4 py-2">{data.fundamentalsSymbol}</td>
                  {PEER_METRICS.map((m) => (
                    <td key={m.key} className="num px-4 py-2 text-right">
                      {formatMetric(data.metrics[m.key] ?? null, m)}
                    </td>
                  ))}
                </tr>
                {data.peers.map((peer) => (
                  <tr key={peer.symbol}>
                    <td className="px-4 py-2">
                      <Link href={`/research?s=US:${encodeURIComponent(peer.symbol)}`} className="hover:text-primary">
                        <span className="font-medium">{peer.symbol}</span>
                        {peer.name && <span className="block max-w-48 truncate text-xs text-muted-foreground">{peer.name}</span>}
                      </Link>
                    </td>
                    {PEER_METRICS.map((m) => (
                      <td key={m.key} className="num px-4 py-2 text-right text-muted-foreground">
                        {formatMetric(peer.values[m.key], m)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="text-xs">
                  <td className="px-4 py-2 text-muted-foreground">Mediana comparables</td>
                  {PEER_METRICS.map((m) => (
                    <td key={m.key} className="num px-4 py-2 text-right">
                      {formatMetric(data.peerMedians[m.key] ?? null, m)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="px-4 py-3 text-[11px] text-muted-foreground">Comparables según Finnhub. Algunos pueden ser de rubros cercanos y no idénticos.</p>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center gap-1">
            <h3 className="font-medium">Qué dicen los analistas</h3>
            <HelpTip id="consenso" />
          </div>
          {data.analysts ? (
            <AnalystsBar a={data.analysts} />
          ) : (
            <p className="text-sm text-muted-foreground">Sin recomendaciones de analistas para esta empresa.</p>
          )}
        </section>

        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center gap-1">
            <h3 className="font-medium">Últimos resultados</h3>
            <HelpTip id="sorpresa" />
          </div>
          {data.earnings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin resultados trimestrales disponibles.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1.5 font-medium">Trimestre</th>
                  <th className="py-1.5 text-right font-medium">Esperado</th>
                  <th className="py-1.5 text-right font-medium">Real</th>
                  <th className="py-1.5 text-right font-medium">Sorpresa</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.earnings.map((e) => (
                  <tr key={e.period}>
                    <td className="py-1.5">
                      T{e.quarter} {e.year}
                    </td>
                    <td className="num py-1.5 text-right text-muted-foreground">{e.estimate !== null ? formatNumber(e.estimate) : "—"}</td>
                    <td className="num py-1.5 text-right">{e.actual !== null ? formatNumber(e.actual) : "—"}</td>
                    <td
                      className={cn(
                        "num py-1.5 text-right font-medium",
                        e.surprisePercent !== null && e.surprisePercent > 0 && "text-up",
                        e.surprisePercent !== null && e.surprisePercent < 0 && "text-down",
                      )}
                    >
                      {e.surprisePercent !== null ? formatPercent(e.surprisePercent) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">Ganancia por acción en USD{data.source === "adr" ? " por ADR" : ""}.</p>
        </section>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Fuente: Finnhub, con datos de los últimos balances publicados. Datos guardados el {formatDate(data.fetchedAt)} a las{" "}
        {formatTime(data.fetchedAt)}
        {data.stale ? " (se actualizarán en la próxima visita)" : ""}. Estos números describen a la empresa; no son una recomendación de
        compra o venta.
      </p>
    </div>
  );
}
