import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Solo para código de servidor: usa node:crypto. Sin "server-only" para poder testearlo con Vitest. */

const IV_BYTES = 12;
const TAG_BYTES = 16;

export class DecryptionError extends Error {
  constructor() {
    super("No se pudo leer un dato protegido");
    this.name = "DecryptionError";
  }
}

export interface TokenCipher {
  encrypt(plain: string): string;
  decrypt(payload: string): string;
}

/**
 * AES-256-GCM con IV aleatorio por mensaje. Formato: base64url(iv | tag | ciphertext).
 * La clave sale de SHA-256 del secreto, así cualquier secreto largo sirve como clave de 256 bits.
 */
export function createTokenCipher(secret: string): TokenCipher {
  if (secret.length < 32) throw new Error("La clave de cifrado debe tener al menos 32 caracteres");
  const key = createHash("sha256").update(secret, "utf8").digest();
  return {
    encrypt(plain) {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
    },
    decrypt(payload) {
      try {
        const raw = Buffer.from(payload, "base64url");
        if (raw.length < IV_BYTES + TAG_BYTES) throw new DecryptionError();
        const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, IV_BYTES));
        decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
        return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
      } catch {
        // Clave rotada, dato alterado o formato inválido: todo se trata igual y sin filtrar detalles.
        throw new DecryptionError();
      }
    },
  };
}

export function randomUrlSafe(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** code_challenge PKCE (S256): base64url(SHA-256(verifier)). */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

/** Comparación en tiempo constante; false si alguno falta o difieren en largo. */
export function safeEqualStrings(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
