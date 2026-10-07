import { HelpTip } from "@/components/help/help-tip";
import { bondMetrics, buildSchedule, remainingFlows, type BondTerms } from "@/lib/bonds";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { getQuote } from "@/lib/market";

const day = (iso: string) => formatDate(`${iso}T12:00:00Z`);

function Row({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="flex items-center gap-1 text-muted-foreground">
        {label}
        {help && <HelpTip id={help} />}
      </dt>
      <dd className="num text-right font-medium">{children}</dd>
    </div>
  );
}

/** Ficha de bono: TIR, paridad, duration, valor técnico y cronograma (RF-16). */
export async function BondSheet({ bond }: { bond: BondTerms }) {
  // El rendimiento se calcula con el precio en dólares MEP (especie "D"), que es el que paga el bono.
  const usd = await getQuote("AR", `${bond.ticker}D`).catch(() => null);
  const settlement = new Date();
  const m = bondMetrics(bond, usd?.price ?? null, settlement);
  const schedule = remainingFlows(buildSchedule(bond), settlement);

  return (
    <>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 font-medium">Ficha del bono</h2>
        <dl className="grid gap-2.5 text-sm">
          <Row label="TIR" help="tir">
            {m.tir !== null ? formatPercent(m.tir * 100).replace("+", "") : "—"}
          </Row>
          <Row label="Paridad" help="paridad">
            {m.parity !== null ? `${formatNumber(m.parity * 100, 1)} %` : "—"}
          </Row>
          <Row label="Duration modificada" help="duration">
            {m.modified !== null ? `${formatNumber(m.modified)} años` : "—"}
          </Row>
          <Row label="Valor técnico" help="valor-tecnico">
            US$ {formatNumber(m.technicalValue)}
          </Row>
          <Row label="Capital pendiente">{formatNumber(m.residual, 2)} %</Row>
          <Row label="Cupón vigente" help="cupon">
            {m.currentCoupon !== null ? `${formatNumber(m.currentCoupon, 3)} % anual` : "—"}
          </Row>
          <Row label="Ley" help="ley">
            {bond.law}
          </Row>
          <Row label="Paga en">Dólares</Row>
          <Row label="Vencimiento">{day(bond.maturity)}</Row>
        </dl>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          {usd
            ? `Calculado con el precio de ${bond.ticker}D (US$ ${formatNumber(usd.price)} cada 100 VN)${usd.delayed ? ", con demora" : ""}.`
            : "No hay precio en dólares disponible: no se puede calcular el rendimiento."}{" "}
          Cronograma cargado a mano; verificalo con tu bróker antes de operar.
        </p>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 font-medium">Próximos pagos</h2>
        <p className="mb-2 text-[11px] text-muted-foreground">Cada 100 de valor nominal original, en dólares.</p>
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1.5 font-medium">Fecha</th>
                <th className="py-1.5 text-right font-medium">Interés</th>
                <th className="py-1.5 text-right font-medium">Capital</th>
                <th className="py-1.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {schedule.map((f) => (
                <tr key={f.date}>
                  <td className="py-1.5">{day(f.date)}</td>
                  <td className="num py-1.5 text-right">{formatNumber(f.interest)}</td>
                  <td className="num py-1.5 text-right">{formatNumber(f.amortization)}</td>
                  <td className="num py-1.5 text-right font-medium">{formatNumber(f.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
