import { env } from "@/lib/env";
import { safeEqual } from "@/lib/telegram";
import { evaluateAlerts } from "@/server/evaluate-alerts";

/**
 * Evaluador de alertas. Lo llama Vercel Cron o un schedule de Upstash QStash
 * (cada 1 min) con el header "Authorization: Bearer <CRON_SECRET>".
 */
async function handle(req: Request) {
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!env.CRON_SECRET || !safeEqual(auth, env.CRON_SECRET)) {
    return new Response("unauthorized", { status: 401 });
  }
  const result = await evaluateAlerts();
  return Response.json({ ...result, at: new Date().toISOString() });
}

export const GET = handle;
export const POST = handle;
