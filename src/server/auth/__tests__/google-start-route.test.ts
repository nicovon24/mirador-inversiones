import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  newFlow: vi.fn(),
  encode: vi.fn(),
}));

vi.mock("@/server/auth/google-oidc", () => ({
  getGoogleConfig: mocks.config,
  newGoogleFlow: mocks.newFlow,
  encodeGoogleFlow: mocks.encode,
  safeReturnTo: (value: string | null) => value?.startsWith("/") && !value.startsWith("//") ? value : "/research",
  GOOGLE_FLOW_COOKIE: "mirador_google_flow",
}));

import { GET } from "@/app/api/auth/google/start/route";

const flow = {
  state: "s".repeat(32),
  nonce: "n".repeat(32),
  verifier: "v".repeat(48),
  returnTo: "/portfolio",
  expiresAt: Date.now() + 60_000,
};

describe.each([
  { name: "Docker local", origin: "http://localhost:3001", internal: "http://localhost:3000", secure: false },
  { name: "Vercel HTTPS", origin: "https://mirador.example.com", internal: "http://internal:3000", secure: true },
])("Google start behind $name", ({ origin, internal, secure }) => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.mockReturnValue({ origin, clientSecret: "secret", secure });
    mocks.newFlow.mockResolvedValue({ flow, authorizationUrl: new URL("https://accounts.google.com/o/oauth2/v2/auth?state=google-state") });
    mocks.encode.mockReturnValue("signed-flow");
  });

  it("sets a callback-scoped flow cookie when the forwarded public origin matches", async () => {
    const publicUrl = new URL(origin);
    const request = new NextRequest(`${internal}/api/auth/google/start?next=%2Fportfolio`, {
      headers: {
        host: publicUrl.host,
        "x-forwarded-host": publicUrl.host,
        "x-forwarded-proto": publicUrl.protocol.slice(0, -1),
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://accounts.google.com/o/oauth2/v2/auth?state=google-state");
    expect(mocks.newFlow).toHaveBeenCalledWith("/portfolio");
    expect(mocks.encode).toHaveBeenCalledWith(flow, "secret");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("mirador_google_flow=signed-flow");
    expect(cookie).toContain("Path=/api/auth/google/callback");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=lax");
    expect(cookie.includes("Secure")).toBe(secure);
  });

  it("redirects to the configured public origin before starting a flow on the wrong host", async () => {
    const response = await GET(new NextRequest(`${internal}/api/auth/google/start?next=%2Fportfolio`));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${origin}/api/auth/google/start?next=%2Fportfolio`);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.newFlow).not.toHaveBeenCalled();
  });
});
