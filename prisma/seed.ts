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
  for (const instrument of STARTER) {
    await db.instrument.upsert({
      where: { symbol_market: { symbol: instrument.symbol, market: instrument.market } },
      update: {},
      create: instrument,
    });
  }
  console.log(`${STARTER.length} instrumentos públicos disponibles.`);
}

main().finally(() => db.$disconnect());
