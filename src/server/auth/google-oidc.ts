import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import * as oidc from "openid-client";

const ISSUER = new URL("https://accounts.google.com");
export const GOOGLE_FLOW_COOKIE = "mirador_google_flow";
const FLOW_TTL_MS = 10 * 60 * 1000;

export type GoogleFlow = {
  state: string;
  nonce: string;
  verifier: string;
  expiresAt: number;
  returnTo: string;
};

export type GoogleConfig = {
  origin: string;
  callbackUrl: string;
  clientId: string;
  clientSecret: string;
  secure: boolean;
};

/** Require a stable, explicitly configured callback origin in every environment. */
export function getGoogleConfig(): GoogleConfig | null {
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret, MIRADOR_APP_URL: appUrl } = process.env;
  if (!clientId || !clientSecret || !appUrl) return null;
  if (clientId !== clientId.trim() || clientSecret !== clientSecret.trim() || appUrl !== appUrl.trim()) return null;

  try {
    const url = new URL(appUrl);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const allowLocalHttp = local && url.protocol === "http:" && !process.env.VERCEL && (
      process.env.NODE_ENV !== "production" || process.env.MIRADOR_LOCAL_AUTH === "true"
    );
    if (
      (url.protocol !== "https:" && !allowLocalHttp) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash
    ) return null;

    return {
      origin: url.origin,
      callbackUrl: `${url.origin}/api/auth/google/callback`,
      clientId,
      clientSecret,
      secure: url.protocol === "https:",
    };
  } catch {
    return null;
  }
}

export function safeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\x00-\x1f\x7f]/.test(value)
  ) {
    return "/research";
  }
  try {
    // URL parsing can turn malformed slash/control combinations into a host.
    if (new URL(value, "https://mirador.invalid").origin !== "https://mirador.invalid") return "/research";
    return value;
  } catch {
    return "/research";
  }
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update("mirador-google-flow-v1:").update(payload).digest("base64url");
}

export function encodeGoogleFlow(flow: GoogleFlow, secret: string): string {
  const payload = Buffer.from(JSON.stringify(flow)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function decodeGoogleFlow(raw: string | undefined, secret: string): GoogleFlow | null {
  if (!raw || raw.length > 2048) return null;
  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const flow: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof flow !== "object" || flow === null) return null;
    const value = flow as Record<string, unknown>;
    if (
      typeof value.state !== "string" || value.state.length < 20 ||
      typeof value.nonce !== "string" || value.nonce.length < 20 ||
      typeof value.verifier !== "string" || value.verifier.length < 20 ||
      typeof value.expiresAt !== "number" ||
      value.expiresAt <= Date.now() || value.expiresAt > Date.now() + FLOW_TTL_MS ||
      typeof value.returnTo !== "string" || safeReturnTo(value.returnTo) !== value.returnTo
    ) return null;
    return value as GoogleFlow;
  } catch {
    return null;
  }
}

let clientPromise: Promise<oidc.Configuration> | null = null;

export async function googleClient(config: GoogleConfig): Promise<oidc.Configuration> {
  if (!clientPromise) {
    clientPromise = oidc.discovery(ISSUER, config.clientId, config.clientSecret).then((client) => {
      oidc.enableNonRepudiationChecks(client);
      return client;
    }).catch((error: unknown) => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

export async function newGoogleFlow(returnTo: string): Promise<{ flow: GoogleFlow; authorizationUrl: URL }> {
  const config = getGoogleConfig();
  if (!config) throw new Error("Google login is not configured");
  const client = await googleClient(config);
  const flow: GoogleFlow = {
    state: oidc.randomState(),
    nonce: oidc.randomNonce(),
    verifier: oidc.randomPKCECodeVerifier(),
    expiresAt: Date.now() + FLOW_TTL_MS,
    returnTo: safeReturnTo(returnTo),
  };
  const authorizationUrl = oidc.buildAuthorizationUrl(client, {
    redirect_uri: config.callbackUrl,
    scope: "openid email",
    response_type: "code",
    prompt: "select_account",
    code_challenge: await oidc.calculatePKCECodeChallenge(flow.verifier),
    code_challenge_method: "S256",
    state: flow.state,
    nonce: flow.nonce,
  });
  return { flow, authorizationUrl };
}

export async function exchangeGoogleCode(callbackUrl: URL, flow: GoogleFlow): Promise<{
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
} | null> {
  const config = getGoogleConfig();
  if (!config || callbackUrl.origin !== config.origin || callbackUrl.pathname !== "/api/auth/google/callback") return null;
  const client = await googleClient(config);
  const tokens = await oidc.authorizationCodeGrant(client, callbackUrl, {
    pkceCodeVerifier: flow.verifier,
    expectedState: flow.state,
    expectedNonce: flow.nonce,
    idTokenExpected: true,
  });
  return tokens.claims() ?? null;
}
