import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { randomUrlSafe, sha256Hex } from "@/lib/security/crypto";

/**
 * Identidad del navegador para la conexión con IOL. La app no tiene login propio: el login es el de IOL
 * (OAuth + PKCE). Esta cookie solo ata el navegador a su conexión, para que cada uno vea su propia cartera.
 */
export const SESSION_COOKIE = "mirador_session";
/** Igual que el límite absoluto de la conexión con IOL: pasado ese plazo hay que autorizar de nuevo. */
const SESSION_TTL_MS = 30 * 24 * 3_600_000;

export interface BrowserIdentity {
  id: string;
}

/** Identidad del navegador actual o null. Se valida contra la base en cada pedido (memoizado por render). */
export const verifySession = cache(async (): Promise<BrowserIdentity | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { id: sha256Hex(token) } });
  if (!session || session.expiresAt.getTime() <= Date.now()) return null;
  return { id: session.userId };
});

/**
 * Devuelve la identidad del navegador o crea una nueva con su cookie. Solo se llama al conectar IOL,
 * así que navegar la app nunca crea filas. De paso limpia identidades abandonadas.
 */
export async function getOrCreateIdentity(): Promise<BrowserIdentity> {
  const existing = await verifySession();
  if (existing) return existing;

  const now = new Date();
  // Identidades sin conexión con IOL y sin sesión vigente: flujos que nunca se completaron.
  await db.user.deleteMany({
    where: { iolConnection: null, sessions: { none: { expiresAt: { gt: now } } }, createdAt: { lt: new Date(now.getTime() - 86_400_000) } },
  });

  const user = await db.user.create({ data: {} });
  const token = randomUrlSafe(32);
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.session.create({ data: { id: sha256Hex(token), userId: user.id, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return { id: user.id };
}

/** Borra la identidad del navegador: en cascada se van su sesión, su conexión con IOL y los tokens. */
export async function destroyIdentity(userId: string): Promise<void> {
  await db.user.deleteMany({ where: { id: userId } });
  (await cookies()).delete(SESSION_COOKIE);
}
