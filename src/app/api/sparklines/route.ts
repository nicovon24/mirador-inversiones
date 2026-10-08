import type { NextRequest } from "next/server";
import { PERIOD_RANGES, type PeriodRange } from "@/lib/series";
import { getSparkSeries, MAX_SPARK_KEYS } from "@/server/sparklines";

/** Series para sparklines de varias filas en un solo pedido: GET ?keys=AR:GGAL,US:AAPL&range=3M */
export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get("range") ?? "1M";
  if (!(PERIOD_RANGES as readonly string[]).includes(range)) {
    return Response.json({ error: "Rango inválido" }, { status: 400 });
  }
  const keys = (req.nextUrl.searchParams.get("keys") ?? "").split(",").filter(Boolean).slice(0, MAX_SPARK_KEYS);
  const series = keys.length ? await getSparkSeries(keys, range as PeriodRange) : {};
  return Response.json({ series }, { headers: { "Cache-Control": "private, max-age=60" } });
}
