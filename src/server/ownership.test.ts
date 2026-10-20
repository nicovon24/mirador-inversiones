import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const fixture = vi.hoisted(() => ({
  userId: null as string | null,
  watchlists: [] as Row[],
  items: [] as Row[],
  instruments: [] as Row[],
  alerts: [] as Row[],
  positions: [] as Row[],
  notifications: [] as Row[],
  settings: [] as Row[],
}));

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth/session", () => ({
  getCurrentUser: async () => fixture.userId ? { id: fixture.userId, email: `${fixture.userId}@gmail.com`, role: "USER" } : null,
  requireUser: async () => {
    if (!fixture.userId) throw new Error("Unauthorized");
    return { id: fixture.userId, email: `${fixture.userId}@gmail.com`, role: "USER" };
  },
}));
vi.mock("@/lib/market", () => ({
  parseKey: (key: string) => {
    const [market, symbol] = key.split(":");
    return market && symbol ? { market, symbol } : null;
  },
  getQuote: vi.fn(),
}));
vi.mock("@/lib/market/types", () => ({ toKey: (market: string, symbol: string) => `${market}:${symbol}` }));
vi.mock("./research-table", () => ({ refreshResearchUniverse: vi.fn() }));

vi.mock("@/lib/db", () => {
  function matches(row: Row, where: Row = {}): boolean {
    return Object.entries(where).every(([field, expected]) => {
      if (field === "watchlist") {
        const list = fixture.watchlists.find((candidate) => candidate.id === row.watchlistId);
        return !!list && matches(list, expected as Row);
      }
      if (typeof expected === "object" && expected !== null && "not" in expected) return row[field] !== expected.not;
      return row[field] === expected;
    });
  }
  function updateMany(rows: Row[], { where, data }: { where: Row; data: Row }) {
    const selected = rows.filter((row) => matches(row, where));
    selected.forEach((row) => Object.assign(row, data));
    return Promise.resolve({ count: selected.length });
  }
  function deleteMany(rows: Row[], { where }: { where: Row }) {
    let count = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (matches(rows[i], where)) { rows.splice(i, 1); count++; }
    }
    return Promise.resolve({ count });
  }
  const instrumentFor = (id: unknown) => fixture.instruments.find((instrument) => instrument.id === id);
  return { db: {
    watchlist: {
      count: async ({ where }: { where: Row }) => fixture.watchlists.filter((row) => matches(row, where)).length,
      findFirst: async ({ where }: { where: Row }) => fixture.watchlists.find((row) => matches(row, where)) ?? null,
      findMany: async ({ where }: { where: Row }) => fixture.watchlists.filter((row) => matches(row, where)).map((list) => ({
        ...list,
        items: fixture.items.filter((item) => item.watchlistId === list.id).map((item) => ({ ...item, instrument: instrumentFor(item.instrumentId) })),
      })),
      create: async ({ data }: { data: Row }) => {
        const row = { id: `list-${fixture.watchlists.length}`, createdAt: new Date(), ...data };
        fixture.watchlists.push(row);
        return row;
      },
      updateMany: (input: { where: Row; data: Row }) => updateMany(fixture.watchlists, input),
      deleteMany: (input: { where: Row }) => deleteMany(fixture.watchlists, input),
    },
    watchlistItem: {
      count: async ({ where }: { where: Row }) => fixture.items.filter((row) => matches(row, where)).length,
      upsert: async ({ create }: { create: Row }) => { fixture.items.push({ id: `item-${fixture.items.length}`, ...create }); },
      deleteMany: (input: { where: Row }) => deleteMany(fixture.items, input),
    },
    instrument: {
      findUnique: async ({ where }: { where: { symbol_market: { symbol: string; market: string } } }) =>
        fixture.instruments.find((row) => row.symbol === where.symbol_market.symbol && row.market === where.symbol_market.market) ?? null,
      upsert: async ({ where, create }: { where: { symbol_market: { symbol: string; market: string } }; create: Row }) => {
        const existing = fixture.instruments.find((row) => row.symbol === where.symbol_market.symbol && row.market === where.symbol_market.market);
        if (existing) return existing;
        const row = { id: `instrument-${fixture.instruments.length}`, ...create };
        fixture.instruments.push(row);
        return row;
      },
    },
    alert: {
      findMany: async ({ where }: { where: Row }) => fixture.alerts.filter((row) => matches(row, where)).map((row) => ({ ...row, instrument: instrumentFor(row.instrumentId) })),
      count: async ({ where }: { where: Row }) => fixture.alerts.filter((row) => matches(row, where)).length,
      create: async ({ data }: { data: Row }) => { fixture.alerts.push({ id: `alert-${fixture.alerts.length}`, ...data }); },
      updateMany: (input: { where: Row; data: Row }) => updateMany(fixture.alerts, input),
      deleteMany: (input: { where: Row }) => deleteMany(fixture.alerts, input),
    },
    position: {
      findMany: async ({ where }: { where: Row }) => fixture.positions.filter((row) => matches(row, where)).map((row) => ({ ...row, instrument: instrumentFor(row.instrumentId) })),
      create: async ({ data }: { data: Row }) => { fixture.positions.push({ id: `position-${fixture.positions.length}`, ...data }); },
      deleteMany: (input: { where: Row }) => deleteMany(fixture.positions, input),
    },
    notification: {
      findMany: async ({ where }: { where: Row }) => fixture.notifications.filter((row) => matches(row, where)),
      updateMany: (input: { where: Row; data: Row }) => updateMany(fixture.notifications, input),
    },
    setting: {
      upsert: async ({ where, create, update }: { where: Row; create: Row; update: Row }) => {
        let row = fixture.settings.find((candidate) => matches(candidate, where));
        if (!row) { row = { ...create }; fixture.settings.push(row); }
        Object.assign(row, update);
        return row;
      },
    },
  } };
});

import * as actions from "./actions";
import * as queries from "./queries";

function seed() {
  fixture.userId = null;
  fixture.instruments = [{ id: "instrument-0", market: "BYMA", symbol: "GGAL", name: "Galicia" }];
  fixture.watchlists = [
    { id: "a-list", ownerId: "a", name: "A", createdAt: new Date(), position: 0 },
    { id: "b-list", ownerId: "b", name: "B", createdAt: new Date(), position: 0 },
    { id: "legacy-list", ownerId: null, name: "Legacy", createdAt: new Date(), position: 0 },
  ];
  fixture.items = [
    { id: "a-item", watchlistId: "a-list", instrumentId: "instrument-0" },
    { id: "b-item", watchlistId: "b-list", instrumentId: "instrument-0" },
    { id: "legacy-item", watchlistId: "legacy-list", instrumentId: "instrument-0" },
  ];
  fixture.alerts = ["a", "b", null].map((ownerId, index) => ({
    id: `${ownerId ?? "legacy"}-alert`, ownerId, instrumentId: "instrument-0", condition: "ABOVE",
    target: 100, basePrice: null, status: "ACTIVE", repeat: false, note: null,
    triggeredAt: null, createdAt: new Date(2026, 0, index + 1),
  }));
  fixture.positions = ["a", "b", null].map((ownerId) => ({
    id: `${ownerId ?? "legacy"}-position`, ownerId, instrumentId: "instrument-0", quantity: 1,
    avgPrice: 100, currency: "ARS", openedAt: new Date(), note: null,
  }));
  fixture.notifications = ["a", "b", null].map((ownerId) => ({
    id: `${ownerId ?? "legacy"}-notification`, ownerId, title: "Alert", body: "body", read: false, createdAt: new Date(),
  }));
  fixture.settings = [
    { ownerId: "b", telegramChatId: "private-b" },
    { ownerId: null, telegramChatId: "legacy-chat" },
  ];
}

describe("private data ownership", () => {
  beforeEach(seed);

  it("rejects every personal-data mutation for visitors", async () => {
    const before = JSON.stringify(fixture);
    const results = await Promise.all([
      actions.createWatchlist("Visitor"), actions.renameWatchlist("b-list", "Changed"),
      actions.deleteWatchlist("b-list"), actions.addToWatchlist({ key: "BYMA:GGAL", watchlistId: "b-list" }),
      actions.removeFromWatchlist({ key: "BYMA:GGAL" }),
      actions.createAlert({ key: "BYMA:GGAL", condition: "ABOVE", target: "10" }),
      actions.setAlertStatus("b-alert", "PAUSED"), actions.deleteAlert("b-alert"),
      actions.createPosition({ key: "BYMA:GGAL", quantity: "1", avgPrice: "10", currency: "ARS" }),
      actions.deletePosition("b-position"), actions.markNotificationsRead(), actions.unlinkTelegram(),
    ]);
    expect(results.every((result) => !result.ok)).toBe(true);
    expect(JSON.stringify(fixture)).toBe(before);
  });

  it("keeps B and unowned legacy rows intact when A submits their IDs", async () => {
    fixture.userId = "a";
    await actions.renameWatchlist("b-list", "Stolen");
    await actions.deleteWatchlist("b-list");
    await actions.renameWatchlist("legacy-list", "Stolen");
    await actions.deleteWatchlist("legacy-list");
    await actions.addToWatchlist({ key: "BYMA:GGAL", watchlistId: "b-list" });
    await actions.removeFromWatchlist({ key: "BYMA:GGAL", watchlistId: "b-list" });
    await actions.removeFromWatchlist({ key: "BYMA:GGAL" });
    await actions.setAlertStatus("b-alert", "PAUSED");
    await actions.deleteAlert("b-alert");
    await actions.setAlertStatus("legacy-alert", "PAUSED");
    await actions.deleteAlert("legacy-alert");
    await actions.deletePosition("b-position");
    await actions.deletePosition("legacy-position");
    await actions.markNotificationsRead();
    await actions.unlinkTelegram();

    expect(fixture.watchlists.map((row) => [row.id, row.name])).toEqual([
      ["a-list", "A"], ["b-list", "B"], ["legacy-list", "Legacy"],
    ]);
    expect(fixture.items.map((row) => row.id)).toEqual(["b-item", "legacy-item"]);
    expect(fixture.alerts.map((row) => [row.id, row.status])).toEqual([
      ["a-alert", "ACTIVE"], ["b-alert", "ACTIVE"], ["legacy-alert", "ACTIVE"],
    ]);
    expect(fixture.positions.map((row) => row.id)).toEqual(["a-position", "b-position", "legacy-position"]);
    expect(fixture.notifications.map((row) => [row.id, row.read])).toEqual([
      ["a-notification", true], ["b-notification", false], ["legacy-notification", false],
    ]);
    expect(fixture.settings.find((row) => row.ownerId === "b")?.telegramChatId).toBe("private-b");
    expect(fixture.settings.find((row) => row.ownerId === null)?.telegramChatId).toBe("legacy-chat");
  });

  it("returns only the current user's rows and nothing private to visitors", async () => {
    fixture.userId = "a";
    expect((await queries.getWatchlists()).map((row) => row.id)).toEqual(["a-list"]);
    expect((await queries.getAlerts()).map((row) => row.id)).toEqual(["a-alert"]);
    expect(await queries.getActiveAlertCount()).toBe(1);
    expect((await queries.getPositions()).map((row) => row.id)).toEqual(["a-position"]);
    expect((await queries.getNotifications()).map((row) => row.id)).toEqual(["a-notification"]);
    expect((await queries.getSettings()).ownerId).toBe("a");

    fixture.userId = "b";
    expect((await queries.getWatchlists()).map((row) => row.id)).toEqual(["b-list"]);
    expect((await queries.getAlerts()).map((row) => row.id)).toEqual(["b-alert"]);
    expect((await queries.getPositions()).map((row) => row.id)).toEqual(["b-position"]);
    expect((await queries.getNotifications()).map((row) => row.id)).toEqual(["b-notification"]);
    expect((await queries.getSettings()).telegramChatId).toBe("private-b");

    fixture.userId = null;
    expect(await queries.getWatchlists()).toEqual([]);
    expect(await queries.getAlerts()).toEqual([]);
    expect(await queries.getActiveAlertCount()).toBe(0);
    expect(await queries.getNotifications()).toEqual([]);
    await expect(queries.getPositions()).rejects.toThrow("Unauthorized");
    await expect(queries.getSettings()).rejects.toThrow("Unauthorized");
  });
});
