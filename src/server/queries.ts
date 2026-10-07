import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { hasDatabase } from "@/lib/env";
import { toKey } from "@/lib/market/types";

/** Si la base no está configurada, las pantallas siguen andando con datos vacíos. */
async function safe<T>(fallback: T, run: () => Promise<T>): Promise<T> {
  if (!hasDatabase) return fallback;
  try {
    return await run();
  } catch (e) {
    console.error("[db]", (e as Error).message);
    return fallback;
  }
}

export const DEFAULT_WATCHLIST = "Mi lista";

export const getWatchlists = cache(() =>
  safe([], async () => {
    const lists = await db.watchlist.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: {
        items: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], include: { instrument: true } },
      },
    });
    return lists.map((l) => ({
      id: l.id,
      name: l.name,
      items: l.items.map((i) => ({
        id: i.id,
        key: toKey(i.instrument.market, i.instrument.symbol),
        symbol: i.instrument.symbol,
        market: i.instrument.market,
        name: i.instrument.name,
      })),
    }));
  }),
);

export type WatchlistView = Awaited<ReturnType<typeof getWatchlists>>[number];

export const getAlerts = cache(() =>
  safe([], async () => {
    const alerts = await db.alert.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { instrument: true },
    });
    return alerts.map((a) => ({
      id: a.id,
      key: toKey(a.instrument.market, a.instrument.symbol),
      symbol: a.instrument.symbol,
      market: a.instrument.market,
      name: a.instrument.name,
      condition: a.condition,
      target: a.target.toString(),
      basePrice: a.basePrice?.toString() ?? null,
      status: a.status,
      repeat: a.repeat,
      note: a.note,
      triggeredAt: a.triggeredAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    }));
  }),
);

export type AlertView = Awaited<ReturnType<typeof getAlerts>>[number];

export const getActiveAlertCount = cache(() => safe(0, () => db.alert.count({ where: { status: "ACTIVE" } })));

export const getNotifications = cache(() =>
  safe([], async () => {
    const rows = await db.notification.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
    return rows.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    }));
  }),
);

export type NotificationView = Awaited<ReturnType<typeof getNotifications>>[number];

export const getPositions = cache(() =>
  safe([], async () => {
    const rows = await db.position.findMany({ orderBy: { openedAt: "desc" }, include: { instrument: true } });
    return rows.map((p) => ({
      id: p.id,
      key: toKey(p.instrument.market, p.instrument.symbol),
      symbol: p.instrument.symbol,
      market: p.instrument.market,
      name: p.instrument.name,
      quantity: p.quantity.toString(),
      avgPrice: p.avgPrice.toString(),
      currency: p.currency,
      openedAt: p.openedAt.toISOString(),
      note: p.note,
    }));
  }),
);

export type PositionView = Awaited<ReturnType<typeof getPositions>>[number];

export const getSettings = cache(() =>
  safe({ id: "singleton", theme: "system", baseCurrency: "ARS", telegramChatId: null as string | null }, () =>
    db.setting.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } }),
  ),
);
