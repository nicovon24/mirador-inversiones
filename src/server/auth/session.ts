import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { randomUrlSafe, sha256Hex } from "@/lib/security/crypto";

/** Nombre de la cookie de sesión. `proxy.ts` solo mira si existe; la validación real es `verifySession`. */
export const SESSION_COOKIE = "mirador_session";
const SESSION_TTL_MS = 30 * 24 * 3_600_000;

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
}

/** Crea la sesión en la base y la cookie. En la base queda solo el hash del token. */
export async function createSession(userId: string): Promise<void> {
  const token = randomUrlSafe(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { id: sha256Hex(token), userId, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Usuario de la sesión actual o null. Valida contra la base en cada pedido (memoizado por render),
 * así una sesión borrada o vencida deja de servir al instante.
 */
export const verifySession = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { id: sha256Hex(token) }, include: { user: true } });
  if (!session || session.expiresAt.getTime() <= Date.now()) return null;
  return { id: session.user.id, email: session.user.email, name: session.user.name };
});

/** Para páginas y Server Actions: devuelve el usuario o manda al login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await verifySession();
  if (!user) redirect("/login");
  return user;
}

export async function deleteSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256Hex(token) } });
  store.delete(SESSION_COOKIE);
}
