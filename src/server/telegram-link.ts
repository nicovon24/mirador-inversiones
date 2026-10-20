import "server-only";
import { db } from "@/lib/db";
import { randomUrlSafe, sha256Hex } from "@/lib/security/crypto";
import { requireUser } from "@/server/auth/session";
import { isAllowedGoogleEmail } from "@/server/auth/google-policy";

const LINK_TTL_MS = 10 * 60_000;
const CODE_PATTERN = /^[A-Za-z0-9_-]{32}$/;

function hashCode(code: string): string {
  return sha256Hex(`telegram-link:${code}`);
}

/** A fresh page view invalidates the preceding Telegram link for this user. */
export async function createTelegramLinkCode(): Promise<string> {
  const user = await requireUser();
  const code = randomUrlSafe(24);
  await db.setting.upsert({
    where: { ownerId: user.id },
    update: { telegramLinkHash: hashCode(code), telegramLinkExpiresAt: new Date(Date.now() + LINK_TTL_MS) },
    create: { ownerId: user.id, telegramLinkHash: hashCode(code), telegramLinkExpiresAt: new Date(Date.now() + LINK_TTL_MS) },
  });
  return code;
}

/** The database transaction consumes a code once and assigns this chat to exactly one account. */
export async function consumeTelegramLinkCode(code: string | undefined, chatId: string): Promise<boolean> {
  if (!code || !CODE_PATTERN.test(code) || !/^-?\d{1,20}$/.test(chatId)) return false;
  const hash = hashCode(code);
  const now = new Date();
  return db.$transaction(async (tx) => {
    const setting = await tx.setting.findUnique({
      where: { telegramLinkHash: hash },
      select: { id: true, ownerId: true, telegramLinkExpiresAt: true, owner: { select: { identityType: true, googleSub: true, email: true } } },
    });
    if (!setting?.ownerId || !setting.telegramLinkExpiresAt || setting.telegramLinkExpiresAt <= now) return false;
    if (setting.owner?.identityType !== "AUTHENTICATED" || !setting.owner.googleSub || !isAllowedGoogleEmail(setting.owner.email)) return false;

    // A chat transferred to another owner must stop receiving the previous owner's alerts.
    await tx.setting.updateMany({
      where: { ownerId: { not: null }, telegramChatId: chatId },
      data: { telegramChatId: null },
    });
    const consumed = await tx.setting.updateMany({
      where: {
        id: setting.id,
        ownerId: setting.ownerId,
        telegramLinkHash: hash,
        telegramLinkExpiresAt: { gt: now },
      },
      data: { telegramChatId: chatId, telegramLinkHash: null, telegramLinkExpiresAt: null },
    });
    if (consumed.count !== 1) throw new Error("El código de Telegram ya fue utilizado");
    return true;
  });
}

/** /stop only affects the authenticated account currently bound to this chat. */
export async function unlinkTelegramChat(chatId: string): Promise<boolean> {
  const { count } = await db.setting.updateMany({
    where: { ownerId: { not: null }, telegramChatId: chatId },
    data: { telegramChatId: null, telegramLinkHash: null, telegramLinkExpiresAt: null },
  });
  return count > 0;
}
