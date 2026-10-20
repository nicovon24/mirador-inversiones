import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getGoogleConfig: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/server/auth/google-oidc", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/auth/google-oidc")>();
  return { ...original, getGoogleConfig: mocks.getGoogleConfig };
});
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import LoginPage from "@/app/login/page";

describe("login page with repeated next parameters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.getGoogleConfig.mockReturnValue({ origin: "https://mirador.example.com" });
  });

  it("renders a safe Google start link for an anonymous visitor", async () => {
    const page = await LoginPage({
      searchParams: Promise.resolve({ next: ["/portfolio", "//evil.example"] }) as Parameters<typeof LoginPage>[0]["searchParams"],
    });
    const html = renderToStaticMarkup(page);
    expect(html).toContain("/api/auth/google/start?next=%2Fresearch");
    expect(html).not.toContain("evil.example");
  });

  it("redirects a signed-in visitor only to an internal route", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user", email: "nicovon24@gmail.com", role: "OWNER" });
    mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
    await expect(LoginPage({
      searchParams: Promise.resolve({ next: ["/portfolio", "//evil.example"] }) as Parameters<typeof LoginPage>[0]["searchParams"],
    })).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/research");
  });
});
