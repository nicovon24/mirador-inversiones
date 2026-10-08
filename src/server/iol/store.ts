/** Persistencia de la integración OAuth con IOL. La implementación real usa Prisma; los tests, una en memoria. */

export interface PendingRow {
  stateHash: string;
  userId: string;
  clientId: string;
  encryptedVerifier: string;
  returnTo: string;
  expiresAt: Date;
}

export interface ConnectionRow {
  userId: string;
  clientId: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  accessTokenExpiresAt: Date;
  authorizedAt: Date;
  absoluteExpiresAt: Date;
}

export interface IolStore {
  findClientId(callbackUri: string): Promise<string | null>;
  saveClientId(callbackUri: string, clientId: string): Promise<void>;
  deleteClient(callbackUri: string): Promise<void>;

  createPending(row: PendingRow): Promise<void>;
  /** Borra y devuelve la autorización pendiente en una sola operación atómica; null si no existe o ya se usó. */
  consumePending(stateHash: string): Promise<PendingRow | null>;
  deleteExpiredPending(now: Date): Promise<void>;

  getConnection(userId: string): Promise<ConnectionRow | null>;
  /** Crea o reemplaza la conexión del usuario y libera cualquier lock de renovación. */
  saveConnection(row: ConnectionRow): Promise<void>;
  deleteConnection(userId: string): Promise<void>;
  /** Actualiza tokens tras un refresh y libera el lock. No toca authorizedAt ni absoluteExpiresAt. */
  updateTokens(
    userId: string,
    tokens: { encryptedAccessToken: string; encryptedRefreshToken: string; accessTokenExpiresAt: Date },
  ): Promise<void>;

  /** Toma el lock de renovación si está libre o vencido. Devuelve true solo a quien lo obtuvo. */
  tryLockRefresh(userId: string, until: Date, now: Date): Promise<boolean>;
  releaseRefreshLock(userId: string): Promise<void>;
}
