import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type SettingRow = {
  id: string;
  ownerId: string | null;
  telegramChatId: string | null;
  telegramLinkHash: string | null;
  telegramLinkExpiresAt: Date | null;
};

const mocks = vi.hoisted(() => {
  const rows: SettingRow[] = [];
  const setting = {
    upsert: vi.fn(async ({ where, update, create }) => {
      let row = rows.find((item) => item.ownerId === where.ownerId);
      if (!row) {
        row = { id: `setting-${where.ownerId}`, telegramChatId: null, ...create };
        rows.push(row!);
      } else Object.assign(row, update);
      return row;
    }),
    findUnique: vi.fn(async ({ where }) => {
      const row = rows.find((item) => item.telegramLinkHash === where.telegramLinkHash);
      if (!row) return null;
      return { ...row, owner: row.ownerId ? { identityType: "AUTHENTICATED", googleSub: `sub-${row.ownerId}`, email: row.ownerId === "user-a" ? "fervon96@gmail.com" : "nicovon24@gmail.com" } : null };
    }),
    updateMany: vi.fn(async ({ where, data }) => {
      let count = 0;
      for (const row of rows) {
        const matches = where.telegramChatId
          ? row.ownerId !== null && row.telegramChatId === where.telegramChatId
          : row.id === where.id && row.ownerId === where.ownerId && row.telegramLinkHash === where.telegramLinkHash &&
            row.telegramLinkExpiresAt !== null && row.telegramLinkExpiresAt > where.telegramLinkExpiresAt.gt;
        if (matches) { Object.assign(row, data); count++; }
      }
      return { count };
    }),
  };
  return { rows, setting, requireUser: vi.fn() };
});

vi.mock("@/lib/db", () => ({ db: { setting: mocks.setting, $transaction: async (fn: (tx: unknown) => unknown) => fn({ setting: mocks.setting }) } }));
vi.mock("@/server/auth/session", () => ({ requireUser: mocks.requireUser }));

import { consumeTelegramLinkCode, createTelegramLinkCode, unlinkTelegramChat } from "./telegram-link";

describe("Telegram links", () => {
  beforeEach(() => {
    mocks.rows.length = 0;
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-a", email: "a@example.com", role: "USER" });
  });

  it("creates a fresh short-lived code and consumes it only once for the signed-in user", async () => {
    const code = await createTelegramLinkCode();
    expect(code).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(mocks.rows[0].telegramLinkHash).not.toBe(code);
    expect(mocks.rows[0].telegramLinkExpiresAt!.getTime()).toBeGreaterThan(Date.now());

    expect(await consumeTelegramLinkCode(code, "12345")).toBe(true);
    expect(mocks.rows[0].telegramChatId).toBe("12345");
    expect(mocks.rows[0].telegramLinkHash).toBeNull();
    expect(await consumeTelegramLinkCode(code, "98765")).toBe(false);
    expect(mocks.rows[0].telegramChatId).toBe("12345");
  });

  it("does not consume an expired code or ownerless legacy row", async () => {
    const code = await createTelegramLinkCode();
    mocks.rows[0].telegramLinkExpiresAt = new Date(Date.now() - 1000);
    expect(await consumeTelegramLinkCode(code, "12345")).toBe(false);

    const legacyCode = await createTelegramLinkCode();
    const hash = mocks.rows[0].telegramLinkHash;
    mocks.rows[0].telegramLinkHash = null;
    mocks.rows.push({ id: "singleton", ownerId: null, telegramChatId: "legacy-chat", telegramLinkHash: hash, telegramLinkExpiresAt: new Date(Date.now() + 60_000) });
    expect(await consumeTelegramLinkCode(legacyCode, "12345")).toBe(false);
    expect(mocks.rows[1].telegramChatId).toBe("legacy-chat");
  });

  it("transfers a chat away from the former owner and /stop unlinks the current owner", async () => {
    mocks.rows.push({ id: "setting-user-b", ownerId: "user-b", telegramChatId: "12345", telegramLinkHash: null, telegramLinkExpiresAt: null });
    const code = await createTelegramLinkCode();
    expect(await consumeTelegramLinkCode(code, "12345")).toBe(true);
    expect(mocks.rows.find((row) => row.ownerId === "user-b")?.telegramChatId).toBeNull();
    expect(await unlinkTelegramChat("12345")).toBe(true);
    expect(mocks.rows.find((row) => row.ownerId === "user-a")?.telegramChatId).toBeNull();
  });
});
