import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  deleteSession: vi.fn(),
  config: vi.fn(),
}));

vi.mock("@/server/auth/session", () => ({
  deleteCurrentSession: mocks.deleteSession,
  SESSION_COOKIE: "mirador_session",
}));
vi.mock("@/server/auth/google-oidc", () => ({ getGoogleConfig: mocks.config }));

import { POST } from "@/app/api/auth/logout/route";

const origin = "https://mirador.example.com";
const request = (headerOrigin?: string) => new NextRequest(`${origin}/api/auth/logout`, {
  method: "POST",
  headers: headerOrigin ? { origin: headerOrigin } : {},
});

describe("logout origin check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.mockReturnValue({ origin });
  });

  it("rejects requests without the exact application origin", async () => {
    expect((await POST(request("https://evil.example.com"))).status).toBe(403);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.deleteSession).not.toHaveBeenCalled();
  });

  it("revokes the session on a same-origin form submission", async () => {
    const response = await POST(request(origin));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${origin}/`);
    expect(response.headers.get("set-cookie")).toContain("mirador_session=");
    expect(mocks.deleteSession).toHaveBeenCalledOnce();
  });
});
