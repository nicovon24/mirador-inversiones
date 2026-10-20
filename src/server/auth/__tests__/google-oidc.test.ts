import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { decodeGoogleFlow, encodeGoogleFlow, getGoogleConfig, safeReturnTo } from "../google-oidc";

const secret = "test-client-secret-with-enough-entropy";
const flow = () => ({
  state: "s".repeat(32),
  nonce: "n".repeat(32),
  verifier: "v".repeat(48),
  expiresAt: Date.now() + 60_000,
  returnTo: "/portfolio",
});

describe("Google login flow", () => {
  it("rejects tampered, expired and incorrectly signed browser flow cookies", () => {
    const encoded = encodeGoogleFlow(flow(), secret);
    expect(decodeGoogleFlow(encoded, secret)).toMatchObject({ returnTo: "/portfolio" });
    expect(decodeGoogleFlow(`${encoded}x`, secret)).toBeNull();
    expect(decodeGoogleFlow(encoded, "different-secret")).toBeNull();
    expect(decodeGoogleFlow(encodeGoogleFlow({ ...flow(), expiresAt: Date.now() - 1 }, secret), secret)).toBeNull();
  });

  it("keeps post-login destinations on this application", () => {
    expect(safeReturnTo("/research")).toBe("/research");
    expect(safeReturnTo("https://evil.example/")).toBe("/research");
    expect(safeReturnTo("//evil.example/")).toBe("/research");
    expect(safeReturnTo("/\\evil.example/")).toBe("/research");
  });

  it("fails closed without a complete fixed callback configuration", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
    vi.stubEnv("MIRADOR_APP_URL", "");
    expect(getGoogleConfig()).toBeNull();
    vi.stubEnv("MIRADOR_APP_URL", "https://mirador.example.com/private");
    expect(getGoogleConfig()).toBeNull();
    vi.stubEnv("MIRADOR_APP_URL", "https://mirador.example.com");
    expect(getGoogleConfig()?.callbackUrl).toBe("https://mirador.example.com/api/auth/google/callback");
    vi.unstubAllEnvs();
  });
});
