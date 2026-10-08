import { DecryptionError, pkceChallenge, randomUrlSafe, safeEqualStrings, sha256Hex, type TokenCipher } from "@/lib/security/crypto";
import { IolError, temporaryError } from "./errors";
import type { IolOAuthHttp } from "./oauth-client";
import type { IolStore } from "./store";

/** Rutas internas a las que se puede volver después de conectar. Cualquier otra se reemplaza por la default. */
export const ALLOWED_RETURN_TO = ["/portfolio", "/settings"] as const;
export const DEFAULT_RETURN_TO = "/portfolio";

const PENDING_TTL_MS = 10 * 60_000;
const ABSOLUTE_TTL_MS = 30 * 24 * 3_600_000;
const REFRESH_MARGIN_MS = 45_000;
const LOCK_TTL_MS = 20_000;
const LOCK_WAIT_MS = 8_000;
const LOCK_POLL_MS = 150;
/** Errores de IOL que indican que el cliente registrado ya no sirve: se olvida para registrarse de nuevo. */
const CLIENT_REJECTION_ERRORS = new Set(["invalid_client", "unauthorized_client"]);

export type CallbackResult = "connected" | "denied" | "expired" | "invalid" | "error" | "unavailable";

export interface IolSessionConfig {
  baseUrl: string;
  callbackUri: string;
}

export interface IolSessionDeps {
  store: IolStore;
  oauth: IolOAuthHttp;
  cipher: TokenCipher;
  config: IolSessionConfig;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

export interface IolStatus {
  connected: boolean;
  authorizedAt?: Date;
  absoluteExpiresAt?: Date;
  daysLeft?: number;
}

export function safeReturnTo(value: string | null | undefined): string {
  return (ALLOWED_RETURN_TO as readonly string[]).includes(value ?? "") ? (value as string) : DEFAULT_RETURN_TO;
}

export function createIolSessionService(deps: IolSessionDeps) {
  const { store, oauth, cipher, config } = deps;
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  async function clientId(): Promise<string> {
    const existing = await store.findClientId(config.callbackUri);
    if (existing) return existing;
    const id = await oauth.register(config.callbackUri);
    await store.saveClientId(config.callbackUri, id);
    return id;
  }

  const notConnected = () => new IolError(401, "Conectá tu cuenta de IOL para ver estos datos", "not_connected");
  const expired = () => new IolError(401, "La conexión con IOL cumplió 30 días. Volvé a autorizarla", "expired");
  const rejected = () => new IolError(401, "IOL rechazó la sesión guardada. Volvé a conectarla", "rejected");

  const isAbsoluteExpired = (c: { absoluteExpiresAt: Date }) => c.absoluteExpiresAt.getTime() <= now().getTime();
  const isFresh = (c: { accessTokenExpiresAt: Date }) => c.accessTokenExpiresAt.getTime() > now().getTime() + REFRESH_MARGIN_MS;

  function decryptOrDrop(userId: string, payload: string): Promise<string> {
    try {
      return Promise.resolve(cipher.decrypt(payload));
    } catch (e) {
      if (!(e instanceof DecryptionError)) throw e;
      // La clave cambió o el dato está corrupto: la conexión es inutilizable.
      return store.deleteConnection(userId).then(() => {
        throw new IolError(401, "La sesión guardada de IOL ya no es válida. Volvé a conectarla", "rejected");
      });
    }
  }

  /** Renueva el access token coordinando entre instancias con un lock en la base. */
  async function refresh(userId: string, force: boolean): Promise<string> {
    const deadline = now().getTime() + LOCK_WAIT_MS;
    for (;;) {
      const t = now();
      if (await store.tryLockRefresh(userId, new Date(t.getTime() + LOCK_TTL_MS), t)) break;
      // Otra instancia está renovando: se espera su resultado en lugar de gastar el refresh token dos veces.
      const current = await store.getConnection(userId);
      if (!current) throw notConnected();
      if (!force && isFresh(current)) return decryptOrDrop(userId, current.encryptedAccessToken);
      if (now().getTime() >= deadline) throw temporaryError();
      await sleep(LOCK_POLL_MS);
    }

    let keepLock = false;
    try {
      const c = await store.getConnection(userId);
      if (!c) {
        keepLock = true; // ya no hay fila que liberar
        throw notConnected();
      }
      if (isAbsoluteExpired(c)) {
        await store.deleteConnection(userId);
        keepLock = true;
        throw expired();
      }
      // Pudo haberla renovado otra instancia entre la lectura anterior y el lock.
      if (!force && isFresh(c)) return await decryptOrDrop(userId, c.encryptedAccessToken);

      const refreshToken = await decryptOrDrop(userId, c.encryptedRefreshToken).catch((e) => {
        keepLock = true;
        throw e;
      });
      let tokens;
      try {
        tokens = await oauth.refresh({ refreshToken, clientId: c.clientId });
      } catch (e) {
        if (e instanceof IolError && (e.status === 400 || e.status === 401)) {
          // Rechazo explícito (p. ej. invalid_grant): el refresh token no sirve más.
          await store.deleteConnection(userId);
          keepLock = true;
          throw rejected();
        }
        // Timeout, 5xx u otra falla transitoria: se conserva la conexión.
        throw temporaryError();
      }
      await store.updateTokens(userId, {
        encryptedAccessToken: cipher.encrypt(tokens.accessToken),
        encryptedRefreshToken: tokens.refreshToken ? cipher.encrypt(tokens.refreshToken) : c.encryptedRefreshToken,
        accessTokenExpiresAt: new Date(now().getTime() + tokens.expiresIn * 1000),
      });
      keepLock = true; // updateTokens ya liberó el lock
      return tokens.accessToken;
    } finally {
      if (!keepLock) await store.releaseRefreshLock(userId).catch(() => undefined);
    }
  }

  return {
    /** Paso 1 a 5: registra (o reutiliza) el cliente, guarda la autorización pendiente y arma la URL de IOL. */
    async beginAuthorization(userId: string, returnTo?: string | null): Promise<{ authorizeUrl: string; state: string }> {
      await store.deleteExpiredPending(now());
      const id = await clientId();
      const state = randomUrlSafe(32);
      const verifier = randomUrlSafe(64);
      await store.createPending({
        stateHash: sha256Hex(state),
        userId,
        clientId: id,
        encryptedVerifier: cipher.encrypt(verifier),
        returnTo: safeReturnTo(returnTo),
        expiresAt: new Date(now().getTime() + PENDING_TTL_MS),
      });
      const url = new URL("/authorize", config.baseUrl);
      url.search = new URLSearchParams({
        response_type: "code",
        client_id: id,
        redirect_uri: config.callbackUri,
        state,
        code_challenge: pkceChallenge(verifier),
        code_challenge_method: "S256",
      }).toString();
      return { authorizeUrl: url.toString(), state };
    },

    /**
     * Pasos 6 a 8. La autorización pendiente se consume antes de cualquier otra cosa que pueda fallar,
     * así un state nunca sirve dos veces aunque el intercambio falle.
     */
    async completeAuthorization(input: {
      code?: string | null;
      state?: string | null;
      error?: string | null;
      cookieState?: string | null;
      sessionUserId?: string | null;
    }): Promise<{ result: CallbackResult; returnTo: string }> {
      const fail = (result: CallbackResult, returnTo = DEFAULT_RETURN_TO) => ({ result, returnTo });
      const { state } = input;
      if (!state) return fail("invalid");
      // La cookie del flujo ata el callback al navegador que lo inició (evita CSRF de login).
      if (!safeEqualStrings(input.cookieState, state)) return fail("invalid");

      const pending = await store.consumePending(sha256Hex(state));
      if (!pending) return fail("invalid");
      if (pending.expiresAt.getTime() <= now().getTime()) return fail("expired", pending.returnTo);
      // Si hay una sesión iniciada, tiene que ser la del usuario que empezó el flujo.
      if (input.sessionUserId && input.sessionUserId !== pending.userId) return fail("invalid");

      if (input.error) {
        if (CLIENT_REJECTION_ERRORS.has(input.error)) await store.deleteClient(config.callbackUri);
        return fail(input.error === "access_denied" ? "denied" : "error", pending.returnTo);
      }
      if (!input.code) return fail("invalid", pending.returnTo);

      let tokens;
      try {
        tokens = await oauth.exchangeCode({
          code: input.code,
          clientId: pending.clientId,
          callbackUri: config.callbackUri,
          verifier: cipher.decrypt(pending.encryptedVerifier),
        });
      } catch (e) {
        return fail(e instanceof IolError && e.temporary ? "unavailable" : "error", pending.returnTo);
      }
      if (!tokens.refreshToken) return fail("error", pending.returnTo);

      const t = now();
      await store.saveConnection({
        userId: pending.userId,
        clientId: pending.clientId,
        encryptedAccessToken: cipher.encrypt(tokens.accessToken),
        encryptedRefreshToken: cipher.encrypt(tokens.refreshToken),
        accessTokenExpiresAt: new Date(t.getTime() + tokens.expiresIn * 1000),
        authorizedAt: t,
        absoluteExpiresAt: new Date(t.getTime() + ABSOLUTE_TTL_MS),
      });
      return { result: "connected", returnTo: pending.returnTo };
    },

    async status(userId: string): Promise<IolStatus> {
      const c = await store.getConnection(userId);
      if (!c) return { connected: false };
      if (isAbsoluteExpired(c)) {
        await store.deleteConnection(userId);
        return { connected: false };
      }
      const daysLeft = Math.max(0, Math.ceil((c.absoluteExpiresAt.getTime() - now().getTime()) / 86_400_000));
      return { connected: true, authorizedAt: c.authorizedAt, absoluteExpiresAt: c.absoluteExpiresAt, daysLeft };
    },

    /** Paso 9: borra la conexión local. Los tokens quedan inutilizables para la app. */
    async disconnect(userId: string): Promise<void> {
      await store.deleteConnection(userId);
    },

    /** Access token vigente del usuario; lo renueva si vence en menos de 45 segundos. */
    async getValidAccessToken(userId: string): Promise<string> {
      const c = await store.getConnection(userId);
      if (!c) throw notConnected();
      if (isAbsoluteExpired(c)) {
        await store.deleteConnection(userId);
        throw expired();
      }
      if (isFresh(c)) return decryptOrDrop(userId, c.encryptedAccessToken);
      return refresh(userId, false);
    },

    /** Renovación forzada, para cuando IOL rechaza un access token que todavía no vencía. */
    forceRefresh(userId: string): Promise<string> {
      return refresh(userId, true);
    },
  };
}

export type IolSessionService = ReturnType<typeof createIolSessionService>;
