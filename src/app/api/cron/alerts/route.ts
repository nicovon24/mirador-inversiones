import { env, hasFinnhub } from "@/lib/env";
import { safeEqual } from "@/lib/telegram";
import { evaluateAlerts } from "@/server/evaluate-alerts";
import { refreshResearchUniverse } from "@/server/research-table";

/** Alcanza para evaluar alertas y bajar hasta 10 empresas (20 llamadas, sin esperar al limitador). */
export const maxDuration = 60;

/** Empresas a refrescar por corrida. Si el cron corre cada minuto, cuando todo está al día no hace ninguna llamada. */
const FUNDAMENTALS_PER_RUN = 10;

/**
 * Evaluador de alertas y refresco de datos fundamentales. Lo llama Vercel Cron o un schedule de
 * Upstash QStash (cada 1 min) con el header "Authorization: Bearer <CRON_SECRET>".
 */
async function handle(req: Request) {
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!env.CRON_SECRET || !safeEqual(auth, env.CRON_SECRET)) {
    return new Response("unauthorized", { status: 401 });
  }
  const result = await evaluateAlerts();
  // Un fallo de Finnhub no debe tapar el resultado de las alertas.
  const fundamentalsUpdated = hasFinnhub
    ? await refreshResearchUniverse(FUNDAMENTALS_PER_RUN).catch((e) => {
        console.error("[cron] fundamentals", e);
        return -1;
      })
    : 0;
  return Response.json({ ...result, fundamentalsUpdated, at: new Date().toISOString() });
}

export const GET = handle;
export const POST = handle;
