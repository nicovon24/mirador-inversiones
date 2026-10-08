import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

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

// ---------- Contraseñas ----------

const SCRYPT = { N: 16_384, r: 8, p: 1, keylen: 64 } as const;

function scryptAsync(password: string, salt: Buffer, N: number, r: number, p: number, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, keylen, { N, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password.normalize("NFKC"), salt, SCRYPT.N, SCRYPT.r, SCRYPT.p, SCRYPT.keylen);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scryptAsync(password.normalize("NFKC"), Buffer.from(salt, "base64url"), Number(n), Number(r), Number(p), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
