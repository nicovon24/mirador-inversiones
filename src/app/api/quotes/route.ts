import type { NextRequest } from "next/server";
import { getQuotes } from "@/lib/market";

export async function GET(req: NextRequest) {
  const keys = (req.nextUrl.searchParams.get("keys") ?? "").split(",").filter(Boolean);
  if (keys.length === 0) return Response.json({ quotes: {}, fetchedAt: new Date().toISOString() });
  const quotes = await getQuotes(keys);
  return Response.json({ quotes, fetchedAt: new Date().toISOString() });
}
