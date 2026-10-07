"use server";

import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getQuote, parseKey } from "@/lib/market";
import { DEFAULT_WATCHLIST } from "./queries";
import { refreshResearchUniverse } from "./research-table";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const keySchema = z.string().refine((k) => parseKey(k) !== null, "Instrumento inválido");
const decimalString = z
  .string()
  .trim()
  // Acepta "1.234,56" (es-AR) y "1234.56". Con coma, los puntos son separadores de miles.
  .transform((v) => (v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v))
  .refine((v) => /^-?\d+(\.\d+)?$/.test(v), "Número inválido");

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
    console.error("[action]", e);
    if (e instanceof Error && /telegram/i.test(e.message)) return { ok: false, error: e.message };
    return { ok: false, error: "No se pudo guardar. Revisá la conexión con la base de datos." };
  }
}

async function upsertInstrument(key: string, name?: string | null) {
  const parsed = parseKey(key);
  if (!parsed) throw new Error("Instrumento inválido");
  return db.instrument.upsert({
    where: { symbol_market: { symbol: parsed.symbol, market: parsed.market } },
    update: name ? { name } : {},
    create: {
      symbol: parsed.symbol,
      market: parsed.market,
      name: name ?? null,
      currency: parsed.market === "US" ? "USD" : "ARS",
    },
  });
}

async function defaultWatchlistId() {
  const first = await db.watchlist.findFirst({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  if (first) return first.id;
  return (await db.watchlist.create({ data: { name: DEFAULT_WATCHLIST } })).id;
}

// ---------- Watchlists ----------

export async function createWatchlist(name: string) {
  return run(async () => {
    const n = z.string().trim().min(1, "Poné un nombre").max(40).parse(name);
    const count = await db.watchlist.count();
    const list = await db.watchlist.create({ data: { name: n, position: count } });
    return { id: list.id };
  });
}

export async function renameWatchlist(id: string, name: string) {
  return run(async () => {
    const n = z.string().trim().min(1, "Poné un nombre").max(40).parse(name);
    await db.watchlist.update({ where: { id }, data: { name: n } });
  });
}

export async function deleteWatchlist(id: string) {
  return run(async () => {
    await db.watchlist.delete({ where: { id } });
  });
}

export async function addToWatchlist(input: { key: string; name?: string | null; watchlistId?: string }) {
  return run(async () => {
    const key = keySchema.parse(input.key);
    const instrument = await upsertInstrument(key, input.name);
    const watchlistId = input.watchlistId ?? (await defaultWatchlistId());
    const count = await db.watchlistItem.count({ where: { watchlistId } });
    await db.watchlistItem.upsert({
      where: { watchlistId_instrumentId: { watchlistId, instrumentId: instrument.id } },
      update: {},
      create: { watchlistId, instrumentId: instrument.id, position: count },
    });
  });
}

export async function removeFromWatchlist(input: { key: string; watchlistId?: string }) {
  return run(async () => {
    const parsed = parseKey(keySchema.parse(input.key))!;
    const instrument = await db.instrument.findUnique({
      where: { symbol_market: { symbol: parsed.symbol, market: parsed.market } },
    });
    if (!instrument) return;
    await db.watchlistItem.deleteMany({
      where: { instrumentId: instrument.id, ...(input.watchlistId ? { watchlistId: input.watchlistId } : {}) },
    });
  });
}

// ---------- Alertas ----------

const alertSchema = z.object({
  key: keySchema,
  name: z.string().nullish(),
  condition: z.enum(["ABOVE", "BELOW", "PCT_CHANGE"]),
  target: decimalString,
  repeat: z.boolean().default(false),
  note: z.string().trim().max(140).nullish(),
});

export async function createAlert(input: z.input<typeof alertSchema>) {
  return run(async () => {
    const data = alertSchema.parse(input);
    if (data.condition !== "PCT_CHANGE" && new Decimal(data.target).lte(0)) {
      throw new z.ZodError([{ code: "custom", message: "El precio objetivo tiene que ser mayor a 0", path: ["target"], input: data.target }]);
    }
    const instrument = await upsertInstrument(data.key, data.name);
    // Para alertas de % guardamos el precio de referencia del momento.
    let basePrice: string | null = null;
    if (data.condition === "PCT_CHANGE") {
      const q = await getQuote(instrument.market, instrument.symbol);
      basePrice = String(q.price);
    }
    await db.alert.create({
      data: {
        instrumentId: instrument.id,
        condition: data.condition,
        target: data.target,
        basePrice,
        repeat: data.repeat,
        note: data.note || null,
      },
    });
  });
}

export async function setAlertStatus(id: string, status: "ACTIVE" | "PAUSED") {
  return run(async () => {
    await db.alert.update({ where: { id }, data: { status, ...(status === "ACTIVE" ? { triggeredAt: null } : {}) } });
  });
}

export async function deleteAlert(id: string) {
  return run(async () => {
    await db.alert.delete({ where: { id } });
  });
}

// ---------- Posiciones manuales ----------

const positionSchema = z.object({
  key: keySchema,
  name: z.string().nullish(),
  quantity: decimalString,
  avgPrice: decimalString,
  currency: z.enum(["ARS", "USD"]),
  note: z.string().trim().max(140).nullish(),
});

export async function createPosition(input: z.input<typeof positionSchema>) {
  return run(async () => {
    const data = positionSchema.parse(input);
    const instrument = await upsertInstrument(data.key, data.name);
    await db.position.create({
      data: {
        instrumentId: instrument.id,
        quantity: data.quantity,
        avgPrice: data.avgPrice,
        currency: data.currency,
        note: data.note || null,
      },
    });
  });
}

export async function deletePosition(id: string) {
  return run(async () => {
    await db.position.delete({ where: { id } });
  });
}

// ---------- Notificaciones y ajustes ----------

export async function markNotificationsRead() {
  return run(async () => {
    await db.notification.updateMany({ where: { read: false }, data: { read: true } });
  });
}

export async function unlinkTelegram() {
  return run(async () => {
    await db.setting.upsert({
      where: { id: "singleton" },
      update: { telegramChatId: null },
      create: { id: "singleton" },
    });
  });
}

// ---------- Telegram ----------

export async function registerTelegramWebhook() {
  return run(async () => {
    const { headers } = await import("next/headers");
    const { setWebhook } = await import("@/lib/telegram");
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    if (!host || host.startsWith("localhost") || host.startsWith("127.")) {
      throw new z.ZodError([
        {
          code: "custom",
          message: "Telegram necesita una URL pública (deploy en Vercel o un túnel tipo ngrok).",
          path: [],
          input: host,
        },
      ]);
    }
    await setWebhook(`${proto}://${host}/api/telegram/webhook`);
  });
}

export async function sendTelegramTest() {
  return run(async () => {
    const { sendMessage } = await import("@/lib/telegram");
    const settings = await db.setting.findUnique({ where: { id: "singleton" } });
    if (!settings?.telegramChatId) {
      throw new z.ZodError([{ code: "custom", message: "Todavía no vinculaste un chat.", path: [], input: null }]);
    }
    await sendMessage(settings.telegramChatId, "🔔 Prueba de Mirador: las alertas llegan a este chat.");
  });
}

/** Botón "Actualizar datos" de Investigación: baja lo vencido o faltante, favoritos primero. */
export async function refreshResearchData(): Promise<ActionResult<{ updated: number }>> {
  return run(async () => ({ updated: await refreshResearchUniverse(20) }));
}
