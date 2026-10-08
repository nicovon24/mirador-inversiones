import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * En desarrollo el cliente se guarda en globalThis para sobrevivir a la recarga en caliente. Se guarda
 * también la clase con la que se creó: si `prisma generate` la regeneró (modelos nuevos), se crea un
 * cliente nuevo en vez de seguir usando uno al que le faltan tablas.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaClass?: typeof PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

function getClient(): PrismaClient {
  if (globalForPrisma.prisma && globalForPrisma.prismaClass === PrismaClient) return globalForPrisma.prisma;
  void globalForPrisma.prisma?.$disconnect().catch(() => undefined);
  const client = createClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
    globalForPrisma.prismaClass = PrismaClient;
  }
  return client;
}

export const db = getClient();
