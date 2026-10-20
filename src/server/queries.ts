import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { toKey } from "@/lib/market/types";
import { getCurrentUser, requireUser } from "@/server/auth/session";

export const DEFAULT_WATCHLIST = "Mi lista";

// Public pages may ask for these lists. A visitor gets no private rows.
export const getWatchlists = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return [];
  const lists = await db.watchlist.findMany({
    where: { ownerId: user.id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: { items: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], include: { instrument: true } } },
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
});

export type WatchlistView = Awaited<ReturnType<typeof getWatchlists>>[number];

export const getAlerts = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return [];
  const alerts = await db.alert.findMany({
    where: { ownerId: user.id },
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
});

export type AlertView = Awaited<ReturnType<typeof getAlerts>>[number];

export const getActiveAlertCount = cache(async () => {
  const user = await getCurrentUser();
  return user ? db.alert.count({ where: { ownerId: user.id, status: "ACTIVE" } }) : 0;
});

export const getNotifications = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return [];
  const rows = await db.notification.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" }, take: 20 });
  return rows.map((n) => ({ id: n.id, title: n.title, body: n.body, read: n.read, createdAt: n.createdAt.toISOString() }));
});

export type NotificationView = Awaited<ReturnType<typeof getNotifications>>[number];

export const getPositions = cache(async () => {
  const user = await requireUser();
  const rows = await db.position.findMany({ where: { ownerId: user.id }, orderBy: { openedAt: "desc" }, include: { instrument: true } });
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
});

export type PositionView = Awaited<ReturnType<typeof getPositions>>[number];

export const getSettings = cache(async () => {
  const user = await requireUser();
  return db.setting.upsert({ where: { ownerId: user.id }, update: {}, create: { ownerId: user.id } });
});
