"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { TokenBucket } from "@/lib/rate-limit";
import { hashPassword, verifyPassword } from "@/lib/security/crypto";
import { createSession, deleteSession } from "./session";

export type LoginState = { error?: string } | undefined;

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresá un email válido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
  next: z.string().optional(),
});

/** Freno a la fuerza bruta: 5 intentos seguidos por email, después uno cada 12 segundos. */
const attempts = new Map<string, TokenBucket>();
function allowAttempt(email: string): boolean {
  let bucket = attempts.get(email);
  if (!bucket) {
    bucket = new TokenBucket(5, 60_000);
    attempts.set(email, bucket);
  }
  return bucket.tryTake();
}

/** Hash de relleno para que un email inexistente tarde lo mismo que uno real. */
let dummyHash: Promise<string> | null = null;

/** Solo se vuelve a rutas internas; nada de URLs absolutas ni "//otro-sitio". */
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { email, password, next } = parsed.data;

  if (!allowAttempt(email)) return { error: "Demasiados intentos. Esperá un minuto y probá de nuevo." };

  const user = await db.user.findUnique({ where: { email } });
  dummyHash ??= hashPassword("contraseña-de-relleno");
  const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));
  if (!user || !ok) return { error: "Email o contraseña incorrectos." };

  await createSession(user.id);
  redirect(safeNext(next));
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
