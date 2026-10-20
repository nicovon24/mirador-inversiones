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

  it("accepts localhost:3001 through Docker's internal localhost:3000 port", async () => {
    mocks.config.mockReturnValue({ origin: "http://localhost:3001" });
    const response = await POST(new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        origin: "http://localhost:3001",
        host: "localhost:3001",
        "x-forwarded-host": "localhost:3001",
        "x-forwarded-proto": "http",
      },
    }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3001/");
    expect(mocks.deleteSession).toHaveBeenCalledOnce();
  });

  it("rejects a mismatched Origin even when forwarded host is the public host", async () => {
    const response = await POST(new NextRequest("http://internal:3000/api/auth/logout", {
      method: "POST",
      headers: {
        origin: "https://evil.example.com",
        "x-forwarded-host": "mirador.example.com",
        "x-forwarded-proto": "https",
      },
    }));
    expect(response.status).toBe(403);
    expect(mocks.deleteSession).not.toHaveBeenCalled();
  });
});
