import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  decode: vi.fn(),
  exchange: vi.fn(),
  user: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock("@/server/auth/google-oidc", () => ({
  getGoogleConfig: mocks.config,
  decodeGoogleFlow: mocks.decode,
  exchangeGoogleCode: mocks.exchange,
  GOOGLE_FLOW_COOKIE: "mirador_google_flow",
}));
vi.mock("@/server/auth/google-user", () => ({ findOrCreateGoogleUser: mocks.user }));
vi.mock("@/server/auth/session", () => ({ createSession: mocks.createSession, SESSION_COOKIE: "mirador_session" }));

import { GET } from "@/app/api/auth/google/callback/route";

const origin = "https://mirador.example.com";
const oldToken = "A".repeat(43);
const request = () => new NextRequest(`${origin}/api/auth/google/callback?code=one-time-code&state=flow-state`, {
  headers: { cookie: `mirador_google_flow=signed-flow; mirador_session=${oldToken}` },
});

describe("Google callback browser session switch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.mockReturnValue({ origin, clientSecret: "secret", secure: true });
    mocks.decode.mockReturnValue({ state: "flow-state", nonce: "nonce", verifier: "verifier", returnTo: "/portfolio" });
    mocks.exchange.mockResolvedValue({ sub: "google-sub-2", email: "nicovon24@gmail.com", email_verified: true });
    mocks.user.mockResolvedValue({ id: "user-2" });
    mocks.createSession.mockResolvedValue({ token: "B".repeat(43), expiresAt: new Date(Date.now() + 60_000) });
  });

  it("passes the existing browser token to atomic session rotation", async () => {
    const response = await GET(request());
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${origin}/portfolio`);
    expect(mocks.createSession).toHaveBeenCalledWith("user-2", oldToken);
  });

  it("keeps the old session when Google rejects the identity", async () => {
    mocks.exchange.mockResolvedValue({ sub: "other", email: "outsider@gmail.com", email_verified: true });
    const response = await GET(request());
    expect(response.headers.get("location")).toContain("/login?error=not_allowed");
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
});
