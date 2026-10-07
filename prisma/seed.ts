import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Market } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const STARTER: { symbol: string; market: Market; name: string; currency: string }[] = [
  { symbol: "GGAL", market: "AR", name: "Grupo Financiero Galicia", currency: "ARS" },
  { symbol: "YPFD", market: "AR", name: "YPF", currency: "ARS" },
  { symbol: "PAMP", market: "AR", name: "Pampa Energía", currency: "ARS" },
  { symbol: "AL30", market: "AR", name: "Bono Rep. Argentina 2030", currency: "ARS" },
  { symbol: "AAPL", market: "US", name: "Apple Inc.", currency: "USD" },
  { symbol: "NVDA", market: "US", name: "NVIDIA Corporation", currency: "USD" },
  { symbol: "MSFT", market: "US", name: "Microsoft Corporation", currency: "USD" },
  { symbol: "MELI", market: "US", name: "MercadoLibre Inc.", currency: "USD" },
];

async function main() {
  if ((await db.watchlist.count()) > 0) {
    console.log("Ya hay listas, no se siembra nada.");
    return;
  }
  const list = await db.watchlist.create({ data: { name: "Mi lista" } });
  for (const [position, s] of STARTER.entries()) {
    const instrument = await db.instrument.upsert({
      where: { symbol_market: { symbol: s.symbol, market: s.market } },
      update: {},
      create: s,
    });
    await db.watchlistItem.create({ data: { watchlistId: list.id, instrumentId: instrument.id, position } });
  }
  await db.setting.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
  console.log(`Lista "${list.name}" creada con ${STARTER.length} instrumentos.`);
}

main().finally(() => db.$disconnect());
