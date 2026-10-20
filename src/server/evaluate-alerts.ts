import "server-only";
import { db } from "@/lib/db";
import { describeRule, isTriggered } from "@/lib/alerts";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { getQuotes, toKey } from "@/lib/market";
import { escapeHtml, hasTelegram, sendMessage } from "@/lib/telegram";
import { isAllowedGoogleEmail } from "@/server/auth/google-policy";
import { getGoogleConfig } from "@/server/auth/google-oidc";

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
  if (!getGoogleConfig()) return { checked: 0, triggered: [], telegram: "not-configured" };
  // Rows without an owner are quarantined legacy data and must never be evaluated.
  const candidates = await db.alert.findMany({
    where: { status: "ACTIVE", ownerId: { not: null } },
    include: { instrument: true, owner: { select: { identityType: true, email: true, googleSub: true } } },
  });
  const alerts = candidates.filter((alert) => alert.owner?.identityType === "AUTHENTICATED" && alert.owner.googleSub && isAllowedGoogleEmail(alert.owner.email));
  if (alerts.length === 0) return { checked: 0, triggered: [], telegram: "not-linked" };

  const quotes = await getQuotes(alerts.map((a) => toKey(a.instrument.market, a.instrument.symbol)));
  const triggered: EvaluationResult["triggered"] = [];
  const messages: { ownerId: string; notificationId: string; html: string }[] = [];

  for (const alert of alerts) {
    if (!alert.ownerId) continue;
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
      where: { id: alert.id, ownerId: alert.ownerId, status: "ACTIVE", triggeredAt: alert.triggeredAt },
      data: update,
    });
    if (count === 0) continue;

    const notification = await db.notification.create({
      data: { ownerId: alert.ownerId, alertId: alert.id, title, body, price: String(quote.price) },
    });
    triggered.push({ id: alert.id, symbol, price: quote.price });
    messages.push({
      ownerId: alert.ownerId,
      notificationId: notification.id,
      html: `🔔 <b>${escapeHtml(title)}</b>\n${escapeHtml(body)}`,
    });
  }

  let telegram: EvaluationResult["telegram"] = "not-linked";
  if (messages.length > 0) {
    if (!hasTelegram()) {
      telegram = "not-configured";
    } else {
      const settings = await db.setting.findMany({
        where: { ownerId: { in: [...new Set(messages.map((message) => message.ownerId))] } },
        select: { ownerId: true, telegramChatId: true },
      });
      const chatByOwner = new Map(settings.filter((s) => s.ownerId && s.telegramChatId).map((s) => [s.ownerId!, s.telegramChatId!]));
      for (const message of messages) {
        const chatId = chatByOwner.get(message.ownerId);
        if (!chatId) continue;
        try {
          await sendMessage(chatId, message.html);
          await db.notification.updateMany({
            where: { id: message.notificationId, ownerId: message.ownerId, sentTo: null },
            data: { sentTo: "telegram" },
          });
          if (telegram !== "error") telegram = "sent";
        } catch (error) {
          console.error("[telegram]", error);
          telegram = "error";
        }
      }
    }
  }

  return { checked: alerts.length, triggered, telegram };
}
