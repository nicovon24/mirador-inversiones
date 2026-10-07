import type { NextRequest } from "next/server";
import { getHistory, parseKey, RANGES, type Range } from "@/lib/market";

export async function GET(req: NextRequest) {
  const parsed = parseKey(req.nextUrl.searchParams.get("key") ?? "");
  const range = (req.nextUrl.searchParams.get("range") ?? "1M") as Range;
  if (!parsed || !RANGES.includes(range)) {
    return Response.json({ error: "Parámetros inválidos" }, { status: 400 });
  }
  try {
    const candles = await getHistory(parsed.market, parsed.symbol, range);
    return Response.json({ candles });
  } catch (e) {
    return Response.json({ candles: [], error: (e as Error).message }, { status: 502 });
  }
}
