import { env } from "@/lib/env";
import { safeEqual, sendMessage } from "@/lib/telegram";
import { consumeTelegramLinkCode, unlinkTelegramChat } from "@/server/telegram-link";

interface Update {
  message?: { chat?: { id: number; type: string }; from?: { id: number }; text?: string };
}

export async function POST(req: Request) {
  // Telegram reenvía el secret_token que registramos en setWebhook.
  if (!safeEqual(req.headers.get("x-telegram-bot-api-secret-token"), env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response("unauthorized", { status: 401 });
  }

  const update = (await req.json()) as Update;
  const msg = update.message;
  // Personal alerts only go to a private chat controlled by the sender.
  if (!msg?.text || msg.chat?.type !== "private" || msg.from?.id !== msg.chat.id) return Response.json({ ok: true });
  const chatId = String(msg.chat.id);
  const [command, arg] = msg.text.trim().split(/\s+/);

  if (command === "/start") {
    if (!await consumeTelegramLinkCode(arg, chatId)) {
      await sendMessage(chatId, "Para vincular este chat abrí Mirador → Ajustes y tocá “Vincular Telegram”.");
      return Response.json({ ok: true });
    }
    await sendMessage(chatId, "✅ Listo. Vas a recibir acá tus alertas de precio de Mirador.\nEnviá /stop para dejar de recibirlas.");
    return Response.json({ ok: true });
  }

  if (command === "/stop") {
    if (await unlinkTelegramChat(chatId)) {
      await sendMessage(chatId, "Desvinculado. No vas a recibir más alertas en este chat.");
    }
  }

  return Response.json({ ok: true });
}
