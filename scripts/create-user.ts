/**
 * Crea un usuario o le cambia la contraseña.
 *   npm run user:create -- tu@email.com
 * La contraseña se pide por consola sin mostrarla (o se toma de USER_PASSWORD, para automatizar).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/security/crypto";

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true });
    const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput.bind(rl);
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
      write(s.startsWith(question) ? s : "");
    };
    rl.question(question, (answer) => {
      rl.close();
      stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error("Uso: npm run user:create -- tu@email.com");
    process.exit(1);
  }
  const password = process.env.USER_PASSWORD ?? (await askHidden("Contraseña (mínimo 10 caracteres): "));
  if (password.length < 10) {
    console.error("La contraseña debe tener al menos 10 caracteres.");
    process.exit(1);
  }

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const passwordHash = await hashPassword(password);
  const user = await db.user.upsert({ where: { email }, create: { email, passwordHash }, update: { passwordHash } });
  // Cambiar la contraseña cierra las sesiones abiertas.
  await db.session.deleteMany({ where: { userId: user.id } });
  console.log(`Usuario listo: ${user.email}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
