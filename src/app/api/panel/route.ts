import type { NextRequest } from "next/server";
import { getPanel, type Panel } from "@/lib/market";

const PANELS: Panel[] = ["acciones", "cedears", "bonos", "usa"];

export async function GET(req: NextRequest) {
  const panel = req.nextUrl.searchParams.get("panel") as Panel;
  if (!PANELS.includes(panel)) return Response.json({ error: "Panel inválido" }, { status: 400 });
  try {
    const quotes = await getPanel(panel);
    return Response.json({ quotes, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return Response.json({ quotes: [], error: (e as Error).message }, { status: 502 });
  }
}
