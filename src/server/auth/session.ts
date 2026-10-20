import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { randomUrlSafe, sha256Hex } from "@/lib/security/crypto";
import { isAllowedGoogleEmail } from "./google-policy";
import { getGoogleConfig } from "./google-oidc";

// Old anonymous sessions used mirador_session. A distinct cookie name prevents
// those browser tokens from being treated as Google account sessions.
export const SESSION_COOKIE = "mirador_google_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
let warnedMissingAuthSchema = false;

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: "USER" | "OWNER";
};

export class UnauthorizedError extends Error {
  constructor() {
    super("Iniciá sesión para continuar.");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("No tenés acceso a esta sección.");
    this.name = "ForbiddenError";
  }
}

/** The cookie is only a random bearer token; all authority is loaded from the database. */
export const getCurrentUser = cache(async (): Promise<AuthenticatedUser | null> => {
  if (!getGoogleConfig()) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) return null;

  let session;
  try {
    session = await db.session.findUnique({
      where: { id: sha256Hex(token) },
      select: {
        expiresAt: true,
        user: { select: { id: true, email: true, role: true, identityType: true, googleSub: true } },
      },
    });
  } catch (error) {
    // Keep public pages available while an additive auth migration is pending.
    // Missing auth columns must never turn a cookie into an authenticated user.
    if (error && typeof error === "object" && "code" in error && error.code === "P2022") {
      if (!warnedMissingAuthSchema) {
        console.error("Google auth schema is not migrated (P2022)");
        warnedMissingAuthSchema = true;
      }
      return null;
    }
    throw error;
  }
  if (!session || session.expiresAt.getTime() <= Date.now()) return null;

  const user = session.user;
  if (
    user.identityType !== "AUTHENTICATED" ||
    !user.googleSub ||
    !user.email ||
    !isAllowedGoogleEmail(user.email)
  ) return null;

  return { id: user.id, email: user.email, role: user.role };
});

/** Kept as an alias while the IOL connection code migrates to Mirador users. */
export const verifySession = getCurrentUser;

export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireRole(role: "USER" | "OWNER"): Promise<AuthenticatedUser> {
  const user = await requireUser();
  if (role === "OWNER" && user.role !== "OWNER") throw new ForbiddenError();
  return user;
}

/** Issue a new cookie token and revoke the previous browser session in one DB transaction. */
export async function createSession(userId: string, previousToken?: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomUrlSafe(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.$transaction(async (tx) => {
    await tx.session.create({ data: { id: sha256Hex(token), userId, expiresAt } });
    if (previousToken && /^[A-Za-z0-9_-]{32,128}$/.test(previousToken)) {
      await tx.session.deleteMany({ where: { id: sha256Hex(previousToken) } });
    }
  });
  return { token, expiresAt };
}

export async function deleteCurrentSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token && /^[A-Za-z0-9_-]{32,128}$/.test(token)) {
    await db.session.deleteMany({ where: { id: sha256Hex(token) } });
  }
}

/** Compatibility shim: an IOL connection must use an existing Mirador account. */
export async function getOrCreateIdentity(): Promise<AuthenticatedUser> {
  return requireUser();
}

/** Compatibility shim: disconnecting IOL must never delete a Mirador account. */
export async function destroyIdentity(userId: string): Promise<void> {
  const user = await requireUser();
  if (user.id !== userId) throw new ForbiddenError();
  await deleteCurrentSession();
  (await cookies()).delete(SESSION_COOKIE);
}
