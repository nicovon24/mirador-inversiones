import "server-only";
import { db } from "@/lib/db";
import { describeRule, isTriggered } from "@/lib/alerts";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { getQuotes, toKey } from "@/lib/market";
import { escapeHtml, hasTelegram, sendMessage } from "@/lib/telegram";

const REPEAT_COOLDOWN_MS = 60 * 60_000;

export interface EvaluationResult {
  checked: number;
  triggered: { id: string; symbol: string; price: number }[];
  telegram: "sent" | "not-linked" | "not-configured" | "error";
}

/**
 * Revisa las alertas activas contra el precio actual. Las que se cumplen:
 * se marcan TRIGGERED (o se re-basan si repiten), generan una notificación
 * in-app y un mensaje de Telegram.
 */
export async function evaluateAlerts(): Promise<EvaluationResult> {
  const alerts = await db.alert.findMany({ where: { status: "ACTIVE" }, include: { instrument: true } });
  if (alerts.length === 0) return { checked: 0, triggered: [], telegram: "not-linked" };

  const quotes = await getQuotes(alerts.map((a) => toKey(a.instrument.market, a.instrument.symbol)));
  const triggered: EvaluationResult["triggered"] = [];
  const messages: string[] = [];

  for (const alert of alerts) {
    const quote = quotes[toKey(alert.instrument.market, alert.instrument.symbol)];
    if (!quote) continue;
    if (alert.repeat && alert.triggeredAt && Date.now() - alert.triggeredAt.getTime() < REPEAT_COOLDOWN_MS) continue;
    const rule = { condition: alert.condition, target: alert.target.toString(), basePrice: alert.basePrice?.toString() };
    if (!isTriggered(rule, quote.price)) continue;

    const symbol = alert.instrument.symbol;
    const ruleText = describeRule(rule, (n) => formatNumber(n));
    const title = `${symbol}: ${ruleText.toLowerCase()}`;
    const body = `Precio ${formatMoney(quote.price, quote.currency)} (${formatPercent(quote.changePct)} en el día)${alert.note ? ` · ${alert.note}` : ""}`;

    // Una alerta que se repite sigue activa, con 1 h de silencio entre avisos.
    // En las de % se re-basa al precio actual para medir el próximo movimiento.
    const now = new Date();
    const update = alert.repeat
      ? { triggeredAt: now, ...(alert.condition === "PCT_CHANGE" ? { basePrice: String(quote.price) } : {}) }
      : { status: "TRIGGERED" as const, triggeredAt: now };

    // El filtro por estado y triggeredAt evita avisos duplicados si dos evaluaciones corren a la vez.
    const { count } = await db.alert.updateMany({
      where: { id: alert.id, status: "ACTIVE", triggeredAt: alert.triggeredAt },
      data: update,
    });
    if (count === 0) continue;

    await db.notification.create({
      data: { alertId: alert.id, title, body, price: String(quote.price) },
    });
    triggered.push({ id: alert.id, symbol, price: quote.price });
    messages.push(`🔔 <b>${escapeHtml(title)}</b>\n${escapeHtml(body)}`);
  }

  let telegram: EvaluationResult["telegram"] = "not-linked";
  if (messages.length > 0) {
    const settings = await db.setting.findUnique({ where: { id: "singleton" } });
    if (!hasTelegram()) telegram = "not-configured";
    else if (settings?.telegramChatId) {
      try {
        for (const m of messages) await sendMessage(settings.telegramChatId, m);
        await db.notification.updateMany({
          where: { alertId: { in: triggered.map((t) => t.id) }, sentTo: null },
          data: { sentTo: "telegram" },
        });
        telegram = "sent";
      } catch (e) {
        console.error("[telegram]", e);
        telegram = "error";
      }
    }
  }

  return { checked: alerts.length, triggered, telegram };
}
