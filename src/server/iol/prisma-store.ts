import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { ConnectionRow, IolStore, PendingRow } from "./store";

const isNotFound = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025";

export const prismaIolStore: IolStore = {
  async findClientId(callbackUri) {
    return (await db.oAuthClient.findUnique({ where: { callbackUri } }))?.clientId ?? null;
  },

  async saveClientId(callbackUri, clientId) {
    await db.oAuthClient.upsert({ where: { callbackUri }, create: { callbackUri, clientId }, update: { clientId } });
  },

  async deleteClient(callbackUri) {
    await db.oAuthClient.deleteMany({ where: { callbackUri } });
  },

  async createPending(row) {
    await db.pendingAuthorization.create({ data: row });
  },

  async consumePending(stateHash): Promise<PendingRow | null> {
    // DELETE ... RETURNING: si dos callbacks llegan a la vez con el mismo state, solo uno obtiene la fila.
    try {
      const r = await db.pendingAuthorization.delete({ where: { stateHash } });
      return {
        stateHash: r.stateHash,
        userId: r.userId,
        clientId: r.clientId,
        encryptedVerifier: r.encryptedVerifier,
        returnTo: r.returnTo,
        expiresAt: r.expiresAt,
      };
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  },

  async deleteExpiredPending(now) {
    await db.pendingAuthorization.deleteMany({ where: { expiresAt: { lt: now } } });
  },

  async getConnection(userId): Promise<ConnectionRow | null> {
    const c = await db.iolConnection.findUnique({ where: { userId } });
    if (!c) return null;
    return {
      userId: c.userId,
      clientId: c.clientId,
      encryptedAccessToken: c.encryptedAccessToken,
      encryptedRefreshToken: c.encryptedRefreshToken,
      accessTokenExpiresAt: c.accessTokenExpiresAt,
      authorizedAt: c.authorizedAt,
      absoluteExpiresAt: c.absoluteExpiresAt,
    };
  },

  async saveConnection(row) {
    const data = { ...row, refreshLockUntil: null };
    await db.iolConnection.upsert({ where: { userId: row.userId }, create: data, update: data });
  },

  async deleteConnection(userId) {
    await db.iolConnection.deleteMany({ where: { userId } });
  },

  async updateTokens(userId, tokens) {
    await db.iolConnection.updateMany({ where: { userId }, data: { ...tokens, refreshLockUntil: null } });
  },

  async tryLockRefresh(userId, until, now) {
    // UPDATE condicional: es atómico en Postgres, así que entre varias instancias solo una ve count = 1.
    const { count } = await db.iolConnection.updateMany({
      where: { userId, OR: [{ refreshLockUntil: null }, { refreshLockUntil: { lt: now } }] },
      data: { refreshLockUntil: until },
    });
    return count === 1;
  },

  async releaseRefreshLock(userId) {
    await db.iolConnection.updateMany({ where: { userId }, data: { refreshLockUntil: null } });
  },
};
