import type { NextRequest } from "next/server";
import { searchInstruments } from "@/lib/market";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 1) return Response.json({ results: [] });
  const results = await searchInstruments(q.slice(0, 40));
  return Response.json({ results });
}
