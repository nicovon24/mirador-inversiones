import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { cached } from "@/lib/market/cache";

const api = (method: string) => `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;

export const hasTelegram = () => Boolean(env.TELEGRAM_BOT_TOKEN);

async function call<T>(method: string, body?: Record<string, unknown>): Promise<T> {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("Falta TELEGRAM_BOT_TOKEN");
  const res = await fetch(api(method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description ?? res.status}`);
  return data.result as T;
}

export function sendMessage(chatId: string, text: string) {
  return call("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true });
}

export function getBotUsername(): Promise<string> {
  return cached("tg:me", 60 * 60_000, async () => (await call<{ username: string }>("getMe")).username);
}

export function setWebhook(url: string) {
  return call("setWebhook", {
    url,
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message"],
  });
}

/**
 * Código para /start. Solo lo ve quien abre Ajustes, así un desconocido que
 * encuentre el bot no puede vincularse y recibir tus alertas.
 */
export function linkCode(): string {
  return createHash("sha256")
    .update(`${env.TELEGRAM_WEBHOOK_SECRET ?? ""}:${env.TELEGRAM_BOT_TOKEN ?? ""}:link`)
    .digest("hex")
    .slice(0, 20);
}

export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
