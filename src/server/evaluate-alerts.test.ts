import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/google-oidc", () => ({ getGoogleConfig: () => ({}) }));

const mocks = vi.hoisted(() => ({
  alertFindMany: vi.fn(),
  alertUpdateMany: vi.fn(),
  notificationCreate: vi.fn(),
  notificationUpdateMany: vi.fn(),
  settingFindMany: vi.fn(),
  getQuotes: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    alert: { findMany: mocks.alertFindMany, updateMany: mocks.alertUpdateMany },
    notification: { create: mocks.notificationCreate, updateMany: mocks.notificationUpdateMany },
    setting: { findMany: mocks.settingFindMany },
  },
}));
vi.mock("@/lib/market", () => ({ getQuotes: mocks.getQuotes, toKey: (market: string, symbol: string) => `${market}:${symbol}` }));
vi.mock("@/lib/telegram", () => ({
  escapeHtml: (value: string) => value,
  hasTelegram: () => true,
  sendMessage: mocks.sendMessage,
}));

import { evaluateAlerts } from "./evaluate-alerts";

const alert = (id: string, ownerId: string) => ({
  id, ownerId, status: "ACTIVE", condition: "ABOVE", target: { toString: () => "100" },
  basePrice: null, repeat: false, note: null, triggeredAt: null,
  instrument: { market: "BYMA", symbol: id },
  owner: { identityType: "AUTHENTICATED", googleSub: `sub-${ownerId}`, email: ownerId === "user-a" ? "fervon96@gmail.com" : "nicovon24@gmail.com" },
});

describe("evaluateAlerts owner isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.alertFindMany.mockResolvedValue([alert("AAA", "user-a"), alert("BBB", "user-b")]);
    mocks.getQuotes.mockResolvedValue({
      "BYMA:AAA": { price: 120, currency: "ARS", changePct: 1 },
      "BYMA:BBB": { price: 120, currency: "ARS", changePct: 1 },
    });
    mocks.alertUpdateMany.mockResolvedValue({ count: 1 });
    mocks.notificationCreate.mockImplementation(async ({ data }) => ({ id: `notification-${data.alertId}` }));
    mocks.notificationUpdateMany.mockResolvedValue({ count: 1 });
    mocks.settingFindMany.mockResolvedValue([
      { ownerId: "user-a", telegramChatId: "chat-a" },
      { ownerId: "user-b", telegramChatId: "chat-b" },
    ]);
    mocks.sendMessage.mockResolvedValue({});
  });

  it("queries only owned alerts, assigns notification owners, and sends to the matching chats", async () => {
    const result = await evaluateAlerts();

    expect(mocks.alertFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "ACTIVE", ownerId: { not: null } },
    }));
    expect(mocks.notificationCreate.mock.calls.map(([input]) => [input.data.alertId, input.data.ownerId]))
      .toEqual([["AAA", "user-a"], ["BBB", "user-b"]]);
    expect(mocks.sendMessage.mock.calls.map(([chatId, html]) => [chatId, html.includes("AAA"), html.includes("BBB")]))
      .toEqual([["chat-a", true, false], ["chat-b", false, true]]);
    expect(result.telegram).toBe("sent");
  });

  it("never uses an ownerless legacy setting as a destination", async () => {
    mocks.settingFindMany.mockResolvedValue([{ ownerId: null, telegramChatId: "legacy-chat" }]);

    const result = await evaluateAlerts();

    expect(mocks.sendMessage).not.toHaveBeenCalled();
    expect(result.telegram).toBe("not-linked");
  });
});
