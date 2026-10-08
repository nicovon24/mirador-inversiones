import { describe, expect, it, vi } from "vitest";
import { createTokenCipher, DecryptionError, hashPassword, pkceChallenge, safeEqualStrings, verifyPassword } from "@/lib/security/crypto";
import { IolError } from "../errors";
import { ALLOWED_READ_TOOLS, createIolGateway } from "../gateway";
import { createMcpClient, payloadOf } from "../mcp-client";
import { createOAuthHttp } from "../oauth-client";
import { mapBalance, mapHoldings } from "../portfolio";

const BASE = "https://mcp.example.test";

function jsonResponse(body: unknown, init: ResponseInit & { headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), { status: 200, ...init, headers: { "content-type": "application/json", ...init.headers } });
}

describe("crypto", () => {
  it("cifra con AES-256-GCM y detecta datos alterados o una clave distinta", () => {
    const a = createTokenCipher("a".repeat(40));
    const enc = a.encrypt("token-secreto");
    expect(enc).not.toContain("token-secreto");
    expect(a.encrypt("token-secreto")).not.toBe(enc); // IV aleatorio
    expect(a.decrypt(enc)).toBe("token-secreto");
    const tampered = enc.slice(0, -2) + (enc.endsWith("A") ? "BB" : "AA");
    expect(() => a.decrypt(tampered)).toThrow(DecryptionError);
    expect(() => createTokenCipher("b".repeat(40)).decrypt(enc)).toThrow(DecryptionError);
    expect(() => createTokenCipher("corta")).toThrow();
  });

  it("PKCE S256 coincide con el ejemplo del RFC 7636", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("hashea contraseñas con scrypt y sal aleatoria", async () => {
    const h = await hashPassword("una-contraseña-larga");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await hashPassword("una-contraseña-larga")).not.toBe(h);
    expect(await verifyPassword("una-contraseña-larga", h)).toBe(true);
    expect(await verifyPassword("otra", h)).toBe(false);
    expect(await verifyPassword("x", "formato-raro")).toBe(false);
  });

  it("compara strings en tiempo constante sin aceptar vacíos", () => {
    expect(safeEqualStrings("abc", "abc")).toBe(true);
    expect(safeEqualStrings("abc", "abd")).toBe(false);
    expect(safeEqualStrings("abc", "abcd")).toBe(false);
    expect(safeEqualStrings(null, null)).toBe(false);
  });
});

describe("cliente OAuth HTTP", () => {
  it("registra un cliente público y canjea el code con PKCE", async () => {
    const fetchMock = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      const path = new URL(String(url)).pathname;
      if (path === "/register") {
        const body = JSON.parse(String(init?.body));
        expect(body.token_endpoint_auth_method).toBe("none");
        expect(body.redirect_uris).toEqual(["https://app/cb"]);
        return jsonResponse({ client_id: "cid" });
      }
      const form = new URLSearchParams(String(init?.body));
      expect(form.get("grant_type")).toBe("authorization_code");
      expect(form.get("code_verifier")).toBe("ver");
      return jsonResponse({ access_token: "at", refresh_token: "rt", expires_in: 600 });
    });
    const http = createOAuthHttp(BASE, fetchMock as typeof fetch);
    expect(await http.register("https://app/cb")).toBe("cid");
    expect(await http.exchangeCode({ code: "c", clientId: "cid", callbackUri: "https://app/cb", verifier: "ver" })).toEqual({
      accessToken: "at",
      refreshToken: "rt",
      expiresIn: 600,
    });
  });

  it("conserva 400/401 como rechazo y convierte 5xx y fallas de red en temporales", async () => {
    const respond = (status: number) => createOAuthHttp(BASE, (async () => new Response("{}", { status })) as typeof fetch);
    await expect(respond(400).refresh({ refreshToken: "r", clientId: "c" })).rejects.toMatchObject({ status: 400, temporary: false });
    await expect(respond(401).refresh({ refreshToken: "r", clientId: "c" })).rejects.toMatchObject({ status: 401, temporary: false });
    await expect(respond(502).refresh({ refreshToken: "r", clientId: "c" })).rejects.toMatchObject({ status: 503, temporary: true });
    const down = createOAuthHttp(BASE, (async () => Promise.reject(new TypeError("fetch failed"))) as typeof fetch);
    await expect(down.refresh({ refreshToken: "r", clientId: "c" })).rejects.toMatchObject({ status: 503, temporary: true });
  });
});

describe("cliente MCP", () => {
  function mcpServer(opts: { status?: number; sse?: boolean } = {}) {
    const seen: { method?: string; headers: Headers }[] = [];
    const fetchMock = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (init?.method === "DELETE") {
        seen.push({ method: "DELETE", headers });
        return new Response(null, { status: 204 });
      }
      if (opts.status) return new Response("", { status: opts.status });
      const body = JSON.parse(String(init?.body));
      seen.push({ method: body.method, headers });
      const reply = (result: unknown) => {
        const payload = JSON.stringify({ jsonrpc: "2.0", id: body.id, result });
        return opts.sse
          ? new Response(`event: message\ndata: ${payload}\n\n`, { headers: { "content-type": "text/event-stream", "mcp-session-id": "s-1" } })
          : jsonResponse(JSON.parse(payload), { headers: { "mcp-session-id": "s-1" } });
      };
      if (body.method === "initialize") return reply({ protocolVersion: "2025-06-18" });
      if (body.method === "notifications/initialized") return new Response(null, { status: 202 });
      if (body.method === "tools/list")
        return reply({ tools: [{ name: "get_balance", inputSchema: {} }, { name: "get_asset_info", inputSchema: { required: ["symbol"] } }] });
      if (body.method === "tools/call") return reply({ content: [{ type: "text", text: JSON.stringify({ ok: body.params.name }) }] });
      return reply({});
    });
    return { fetchMock, seen };
  }

  it("abre sesión, llama herramientas con Bearer y cierra la sesión", async () => {
    const { fetchMock, seen } = mcpServer();
    const mcp = createMcpClient(BASE, fetchMock as typeof fetch);
    const results = await mcp.callTools("tok", [{ tool: "get_balance" }, { tool: "get_asset_info" }, { tool: "inexistente" }]);
    expect(results.map((r) => r.status)).toEqual(["success", "missing_argument", "unavailable"]);
    expect(payloadOf(results[0].result)).toEqual({ ok: "get_balance" });
    expect(seen.map((s) => s.method)).toEqual(["initialize", "notifications/initialized", "tools/list", "tools/call", "DELETE"]);
    expect(seen.every((s) => s.headers.get("authorization") === "Bearer tok")).toBe(true);
    expect(seen.slice(1).every((s) => s.headers.get("mcp-session-id") === "s-1")).toBe(true);
  });

  it("entiende respuestas en formato SSE", async () => {
    const { fetchMock } = mcpServer({ sse: true });
    const results = await createMcpClient(BASE, fetchMock as typeof fetch).callTools("tok", [{ tool: "get_balance" }]);
    expect(results[0].status).toBe("success");
  });

  it("propaga el 401 para que se renueve el token", async () => {
    const { fetchMock } = mcpServer({ status: 401 });
    await expect(createMcpClient(BASE, fetchMock as typeof fetch).callTools("tok", [{ tool: "get_balance" }])).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe("gateway de solo lectura", () => {
  const session = () => ({ getValidAccessToken: vi.fn(async () => "old"), forceRefresh: vi.fn(async () => "new") });

  it("descarta toda herramienta fuera de la lista explícita sin tocar la red", async () => {
    const mcp = { callTools: vi.fn(async () => []), toolSchema: vi.fn() };
    const s = session();
    const gw = createIolGateway(mcp as never, s);
    for (const tool of ["buy_ggal_at_50_cents", "validate_order", "accept_ddjj", "get_ddjj", "place_order", "get_activities"]) {
      expect(ALLOWED_READ_TOOLS.has(tool)).toBe(false);
      expect(await gw.callReadTools("u1", [{ tool }])).toEqual([]);
    }
    expect(mcp.callTools).not.toHaveBeenCalled();
    expect(s.getValidAccessToken).not.toHaveBeenCalled();

    await gw.callReadTools("u1", [{ tool: "get_portfolio" }, { tool: "validate_order" }]);
    expect(mcp.callTools).toHaveBeenCalledWith("old", [{ tool: "get_portfolio" }]);
  });

  it("ante un 401 renueva el token una vez y reintenta", async () => {
    const mcp = {
      callTools: vi.fn().mockRejectedValueOnce(new IolError(401, "x")).mockResolvedValueOnce([{ status: "success" }]),
      toolSchema: vi.fn(),
    };
    const s = session();
    const out = await createIolGateway(mcp as never, s).callReadTools("u1", [{ tool: "get_balance" }]);
    expect(out).toEqual([{ status: "success" }]);
    expect(s.forceRefresh).toHaveBeenCalledWith("u1");
    expect(mcp.callTools).toHaveBeenLastCalledWith("new", [{ tool: "get_balance" }]);
  });

  it("no reintenta ante fallas temporales", async () => {
    const mcp = { callTools: vi.fn(async () => Promise.reject(new IolError(503, "x", "temporary"))), toolSchema: vi.fn() };
    const s = session();
    await expect(createIolGateway(mcp as never, s).callReadTools("u1", [{ tool: "get_balance" }])).rejects.toMatchObject({ status: 503 });
    expect(s.forceRefresh).not.toHaveBeenCalled();
  });
});

describe("mapeo de cartera", () => {
  it("calcula precio unitario por lote (bonos cada 100) y descarta monedas desconocidas", () => {
    const holdings = mapHoldings({
      positions: [
        { quantity: 687, lot_price: 110400, daily_change_pct: 0.35, asset: { symbol: "AL35", description: "Bonar", type: "TIT. PUBLICOS", currency: "ARS", units_per_lot: 100 } },
        { quantity: 77, unit_price: "25140", asset: { symbol: "MELI", type: "CEDEARS", currency: "peso_argentino" } },
        { quantity: 1, unit_price: 1, asset: { symbol: "RARO", currency: "EUR" } },
      ],
    });
    expect(holdings).toHaveLength(2);
    expect(holdings[0]).toMatchObject({ symbol: "AL35", lastPrice: 1104, value: 687 * 1104, avgPrice: null, pnl: null, dayChangePct: 0.35 });
    expect(holdings[1]).toMatchObject({ symbol: "MELI", name: "MELI", currency: "ARS", value: 77 * 25140 });
  });

  it("suma los plazos t0..t3 por moneda", () => {
    const cash = mapBalance({
      arg_ars: { totals: { t0: 100, t1: 50, t2: 0, t3: 0 }, available: { t0: 80, t1: 0, t2: 0, t3: 0 } },
      arg_usd: { totals: { t0: 10 }, available: { t0: 10 } },
      eeuu_usd: { totals: { t0: 5 }, available: { t0: 1 } },
    });
    expect(cash).toEqual([
      { currency: "ARS", available: 80, total: 150 },
      { currency: "USD", available: 11, total: 15 },
    ]);
  });
});
