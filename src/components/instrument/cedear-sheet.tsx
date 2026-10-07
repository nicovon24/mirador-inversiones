import { HelpTip } from "@/components/help/help-tip";
import { CEDEAR_RATIOS, cedearImplied } from "@/lib/cedears";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { getFx, getQuote } from "@/lib/market";

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

/** Ficha de CEDEAR: subyacente, ratio, dólar implícito y brecha (RF-15). */
export async function CedearSheet({ symbol }: { symbol: string }) {
  const info = CEDEAR_RATIOS[symbol];
  if (!info) return null;

  const [cedear, underlying, ccl] = await Promise.all([
    getQuote("AR", symbol).catch(() => null),
    getQuote("US", info.underlying.replace(".", "-")).catch(() => null),
    getFx("CCL").catch(() => null),
  ]);
  const implied =
    cedear && underlying && ccl ? cedearImplied(cedear.price, underlying.price, info.ratio, ccl.price) : null;

  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="mb-3 font-medium">Ficha del CEDEAR</h2>
      <dl className="grid gap-2.5 text-sm">
        <Row label="Subyacente">
          {info.name} ({info.underlying})
        </Row>
        <Row label="Ratio de conversión" help="ratio">
          {info.ratio} : 1
        </Row>
        <Row label="Precio del subyacente">{underlying ? formatMoney(underlying.price, "USD") : "—"}</Row>
        <Row label="Dólar CCL implícito" help="ccl">
          {implied ? formatMoney(implied.impliedFx, "ARS") : "—"}
        </Row>
        <Row label="CCL de referencia">{ccl ? formatMoney(ccl.price, "ARS") : "—"}</Row>
        <Row label="Brecha" help="brecha">
          {implied ? formatPercent(implied.gap * 100) : "—"}
        </Row>
        <Row label="Precio teórico">{implied ? formatMoney(implied.theoreticalPrice, "ARS") : "—"}</Row>
      </dl>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        {implied
          ? implied.gap > 0
            ? `Cotiza ${formatNumber(implied.gap * 100, 1)} % por encima de su precio teórico.`
            : `Cotiza ${formatNumber(Math.abs(implied.gap) * 100, 1)} % por debajo de su precio teórico.`
          : "No se pudo calcular el dólar implícito: puede faltar algún precio o el ratio cargado estar desactualizado."}{" "}
        Los ratios están cargados a mano; confirmalos con tu bróker antes de operar.
      </p>
    </section>
  );
}
