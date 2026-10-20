import { describe, expect, it } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { config, proxy } from "./proxy";

function request(path: string, cookie?: string) {
  return new NextRequest(`https://mirador.example${path}`, {
    headers: cookie ? { cookie: `mirador_session=${cookie}` } : undefined,
  });
}

describe("navegación privada", () => {
  it("redirige visitantes a Google login, conservando la ruta local", () => {
    for (const path of ["/research", "/portfolio", "/watchlist", "/alerts", "/settings"]) {
      const response = proxy(request(path));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(`https://mirador.example/login?next=${encodeURIComponent(path)}`);
    }
  });

  it("deja públicos el mercado, los instrumentos, las guías y el login", () => {
    for (const path of ["/", "/markets", "/instrument/AR/GGAL", "/learn", "/glossary", "/login", "/api/quotes"]) {
      expect(proxy(request(path)).status).toBe(200);
    }
  });

  it("delega al servidor la validación de una cookie presente", () => {
    // Esta cookie puede ser falsa o legacy: los datos se autorizan en las páginas/DAL.
    expect(proxy(request("/portfolio", "legacy-or-invalid")).status).toBe(200);
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "https://mirador.example/portfolio" })).toBe(true);
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "https://mirador.example/_next/static/app.js" })).toBe(false);
  });
});
