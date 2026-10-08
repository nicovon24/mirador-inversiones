import { vi } from "vitest";
import { createTokenCipher } from "@/lib/security/crypto";
import type { IolOAuthHttp, TokenResponse } from "../oauth-client";
import { createIolSessionService } from "../session-service";
import type { ConnectionRow, IolStore, PendingRow } from "../store";

/** Store en memoria con la misma semántica que la de Prisma: consumo atómico y lock condicional. */
export function memoryStore() {
  const clients = new Map<string, string>();
  const pending = new Map<string, PendingRow>();
  const connections = new Map<string, ConnectionRow>();
  const locks = new Map<string, Date | null>();

  const store: IolStore = {
    async findClientId(uri) {
      return clients.get(uri) ?? null;
    },
    async saveClientId(uri, id) {
      clients.set(uri, id);
    },
    async deleteClient(uri) {
      clients.delete(uri);
    },
    async createPending(row) {
      pending.set(row.stateHash, { ...row });
    },
    async consumePending(hash) {
      const row = pending.get(hash) ?? null;
      pending.delete(hash);
      return row;
    },
    async deleteExpiredPending(now) {
      for (const [k, v] of pending) if (v.expiresAt < now) pending.delete(k);
    },
    async getConnection(userId) {
      const c = connections.get(userId);
      return c ? { ...c } : null;
    },
    async saveConnection(row) {
      connections.set(row.userId, { ...row });
      locks.set(row.userId, null);
    },
    async deleteConnection(userId) {
      connections.delete(userId);
      locks.delete(userId);
    },
    async updateTokens(userId, tokens) {
      const c = connections.get(userId);
      if (c) connections.set(userId, { ...c, ...tokens });
      locks.set(userId, null);
    },
    async tryLockRefresh(userId, until, now) {
      // Chequeo y escritura sin await en el medio: atómico dentro del event loop, como el UPDATE condicional.
      if (!connections.has(userId)) return false;
      const current = locks.get(userId) ?? null;
      if (current && current >= now) return false;
      locks.set(userId, until);
      return true;
    },
    async releaseRefreshLock(userId) {
      if (connections.has(userId)) locks.set(userId, null);
    },
  };
  return { store, clients, pending, connections, locks };
}

export function fakeOAuth(overrides: Partial<IolOAuthHttp> = {}) {
  let n = 0;
  const tokens = (): TokenResponse => {
    n += 1;
    return { accessToken: `access-${n}`, refreshToken: `refresh-${n}`, expiresIn: 900 };
  };
  return {
    register: vi.fn(async () => "client-1"),
    exchangeCode: vi.fn(async () => tokens()),
    refresh: vi.fn(async () => tokens()),
    ...overrides,
  } satisfies IolOAuthHttp;
}

export const SECRET = "x".repeat(48);
export const CONFIG = { baseUrl: "https://mcp.example.test", callbackUri: "https://app.example.test/api/iol/callback" };

export function setup(opts: { oauth?: IolOAuthHttp; start?: Date } = {}) {
  const mem = memoryStore();
  const oauth = opts.oauth ?? fakeOAuth();
  let clock = (opts.start ?? new Date("2026-10-07T12:00:00Z")).getTime();
  const cipher = createTokenCipher(SECRET);
  const service = createIolSessionService({
    store: mem.store,
    oauth,
    cipher,
    config: CONFIG,
    now: () => new Date(clock),
    sleep: async (ms) => {
      clock += ms;
      await new Promise((r) => setTimeout(r, 1));
    },
  });
  return {
    ...mem,
    oauth,
    cipher,
    service,
    advance(ms: number) {
      clock += ms;
    },
    now: () => new Date(clock),
  };
}

/** Recorre el flujo completo hasta tener una conexión guardada. */
export async function connect(ctx: ReturnType<typeof setup>, userId: string) {
  const { state } = await ctx.service.beginAuthorization(userId, "/portfolio");
  return ctx.service.completeAuthorization({ code: "code-ok", state, cookieState: state, sessionUserId: userId });
}
