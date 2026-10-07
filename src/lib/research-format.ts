import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import type { MetricDef } from "@/lib/research";

/** Formato de un dato fundamental según su tipo (ratio, porcentaje, monto…). */
export function formatMetric(value: number | null, def: Pick<MetricDef, "format">): string {
  if (value === null) return "—";
  switch (def.format) {
    case "pct":
      return `${formatNumber(value)} %`;
    case "signedPct":
      return formatPercent(value);
    case "money":
      return formatMoney(value, "USD");
    case "millions":
      return value >= 1_000_000
        ? `US$ ${formatNumber(value / 1_000_000, 2)} billones`
        : value >= 1_000
          ? `US$ ${formatNumber(value / 1_000, 1)} mil M`
          : `US$ ${formatNumber(value, 0)} M`;
    case "times":
      return `${formatNumber(value)}x`;
    default:
      return formatNumber(value);
  }
}
