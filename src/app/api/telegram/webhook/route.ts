import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { linkCode, safeEqual, sendMessage } from "@/lib/telegram";

interface Update {
  message?: { chat: { id: number }; text?: string };
}

export async function POST(req: Request) {
  // Telegram reenvía el secret_token que registramos en setWebhook.
  if (!safeEqual(req.headers.get("x-telegram-bot-api-secret-token"), env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response("unauthorized", { status: 401 });
  }

  const update = (await req.json()) as Update;
  const msg = update.message;
  if (!msg?.text) return Response.json({ ok: true });
  const chatId = String(msg.chat.id);
  const [command, arg] = msg.text.trim().split(/\s+/);

  if (command === "/start") {
    if (!safeEqual(arg, linkCode())) {
      await sendMessage(chatId, "Para vincular este chat abrí Mirador → Ajustes y tocá “Vincular Telegram”.");
      return Response.json({ ok: true });
    }
    await db.setting.upsert({
      where: { id: "singleton" },
      update: { telegramChatId: chatId },
      create: { id: "singleton", telegramChatId: chatId },
    });
    await sendMessage(chatId, "✅ Listo. Vas a recibir acá tus alertas de precio de Mirador.\nEnviá /stop para dejar de recibirlas.");
    return Response.json({ ok: true });
  }

  if (command === "/stop") {
    const settings = await db.setting.findUnique({ where: { id: "singleton" } });
    if (settings?.telegramChatId === chatId) {
      await db.setting.update({ where: { id: "singleton" }, data: { telegramChatId: null } });
      await sendMessage(chatId, "Desvinculado. No vas a recibir más alertas en este chat.");
    }
  }

  return Response.json({ ok: true });
}
