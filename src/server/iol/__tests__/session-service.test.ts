import { describe, expect, it, vi } from "vitest";
import { pkceChallenge, sha256Hex } from "@/lib/security/crypto";
import { IolError } from "../errors";
import { safeReturnTo } from "../session-service";
import { CONFIG, connect, fakeOAuth, setup } from "./fakes";

const DAY = 86_400_000;

describe("beginAuthorization", () => {
  it("registra el cliente una sola vez por callback y arma la URL de IOL con PKCE S256", async () => {
    const ctx = setup();
    const a = await ctx.service.beginAuthorization("u1", "/portfolio");
    await ctx.service.beginAuthorization("u1", "/portfolio");
    expect(ctx.oauth.register).toHaveBeenCalledTimes(1);
    expect(ctx.oauth.register).toHaveBeenCalledWith(CONFIG.callbackUri);

    const url = new URL(a.authorizeUrl);
    expect(url.origin + url.pathname).toBe("https://mcp.example.test/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.callbackUri);
    expect(url.searchParams.get("state")).toBe(a.state);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");

    // En la base: solo el hash del state y el verifier cifrado, que corresponde al challenge enviado.
    const row = ctx.pending.get(sha256Hex(a.state))!;
    expect(row).toBeDefined();
    expect(row.encryptedVerifier).not.toContain(a.state);
    expect(pkceChallenge(ctx.cipher.decrypt(row.encryptedVerifier))).toBe(url.searchParams.get("code_challenge"));
    expect(row.expiresAt.getTime() - ctx.now().getTime()).toBe(10 * 60_000);
  });

  it("solo acepta rutas internas predefinidas como returnTo", async () => {
    expect(safeReturnTo("/settings")).toBe("/settings");
    expect(safeReturnTo("https://evil.test")).toBe("/portfolio");
    expect(safeReturnTo("//evil.test")).toBe("/portfolio");
    expect(safeReturnTo("/portfolio?x=1")).toBe("/portfolio");
    const ctx = setup();
    const { state } = await ctx.service.beginAuthorization("u1", "https://evil.test");
    expect(ctx.pending.get(sha256Hex(state))!.returnTo).toBe("/portfolio");
  });
});

describe("completeAuthorization: conexión exitosa", () => {
  it("intercambia el code con el verifier y guarda los tokens cifrados", async () => {
    const ctx = setup();
    const { state } = await ctx.service.beginAuthorization("u1", "/settings");
    const verifier = ctx.cipher.decrypt(ctx.pending.get(sha256Hex(state))!.encryptedVerifier);

    const out = await ctx.service.completeAuthorization({ code: "the-code", state, cookieState: state, sessionUserId: "u1" });
    expect(out).toEqual({ result: "connected", returnTo: "/settings" });
    expect(ctx.oauth.exchangeCode).toHaveBeenCalledWith({
      code: "the-code",
      clientId: "client-1",
      callbackUri: CONFIG.callbackUri,
      verifier,
    });

    const c = ctx.connections.get("u1")!;
    expect(c.encryptedAccessToken).not.toContain("access-1");
    expect(ctx.cipher.decrypt(c.encryptedAccessToken)).toBe("access-1");
    expect(ctx.cipher.decrypt(c.encryptedRefreshToken)).toBe("refresh-1");
    expect(c.absoluteExpiresAt.getTime() - c.authorizedAt.getTime()).toBe(30 * DAY);
    expect(ctx.pending.size).toBe(0);
    expect(await ctx.service.getValidAccessToken("u1")).toBe("access-1");
  });

  it("acepta el callback sin sesión iniciada (lo autorizan el state y la cookie)", async () => {
    const ctx = setup();
    const { state } = await ctx.service.beginAuthorization("u1");
    const out = await ctx.service.completeAuthorization({ code: "c", state, cookieState: state, sessionUserId: null });
    expect(out.result).toBe("connected");
  });

  it("falla si IOL no devuelve refresh token", async () => {
    const ctx = setup({ oauth: fakeOAuth({ exchangeCode: vi.fn(async () => ({ accessToken: "a", refreshToken: null, expiresIn: 900 })) }) });
    expect((await connect(ctx, "u1")).result).toBe("error");
    expect(ctx.connections.size).toBe(0);
  });
});

describe("completeAuthorization: rechazo del consentimiento", () => {
  it("consume el state, no guarda conexión y vuelve con 'denied'", async () => {
    const ctx = setup();
    const { state } = await ctx.service.beginAuthorization("u1", "/settings");
    const out = await ctx.service.completeAuthorization({ error: "access_denied", state, cookieState: state });
    expect(out).toEqual({ result: "denied", returnTo: "/settings" });
    expect(ctx.oauth.exchangeCode).not.toHaveBeenCalled();
    expect(ctx.connections.size).toBe(0);
    expect(ctx.pending.size).toBe(0);
  });

  it("si IOL rechaza el cliente registrado, lo olvida para registrarse de nuevo", async () => {
    const ctx = setup();
    const { state } = await ctx.service.beginAuthorization("u1");
    await ctx.service.completeAuthorization({ error: "invalid_client", state, cookieState: state });
    expect(ctx.clients.size).toBe(0);
    await ctx.service.beginAuthorization("u1");
    expect(ctx.oauth.register).toHaveBeenCalledTimes(2);
  });
});

describe("completeAuthorization: state inválido, vencido o reutilizado", () => {
  it("rechaza un state desconocido o ausente", async () => {
    const ctx = setup();
    expect((await ctx.service.completeAuthorization({ code: "c", state: "nope", cookieState: "nope" })).result).toBe("invalid");
    expect((await ctx.service.completeAuthorization({ code: "c", state: null, cookieState: null })).result).toBe("invalid");
    expect(ctx.oauth.exchangeCode).not.toHaveBeenCalled();
  });

  it("rechaza si la cookie del flujo no coincide (otro navegador) y no consume el state", async () => {
    const ctx = setup();
    const { state } = await ctx.service.beginAuthorization("u1");
    expect((await ctx.service.completeAuthorization({ code: "c", state, cookieState: "otro" })).result).toBe("invalid");
    expect((await ctx.service.completeAuthorization({ code: "c", state, cookieState: null })).result).toBe("invalid");
    expect(ctx.pending.size).toBe(1);
    expect(ctx.oauth.exchangeCode).not.toHaveBeenCalled();
  });

  it("rechaza un state vencido a los 10 minutos", async () => {
    const ctx = setup();
    const { state } = await ctx.service.beginAuthorization("u1", "/settings");
    ctx.advance(10 * 60_000 + 1);
    const out = await ctx.service.completeAuthorization({ code: "c", state, cookieState: state });
    expect(out).toEqual({ result: "expired", returnTo: "/settings" });
    expect(ctx.oauth.exchangeCode).not.toHaveBeenCalled();
    expect(ctx.connections.size).toBe(0);
  });

  it("un state no sirve dos veces, aunque el primer intercambio haya fallado", async () => {
    const ctx = setup({ oauth: fakeOAuth({ exchangeCode: vi.fn(async () => Promise.reject(new IolError(400, "x"))) }) });
    const { state } = await ctx.service.beginAuthorization("u1");
    expect((await ctx.service.completeAuthorization({ code: "c", state, cookieState: state })).result).toBe("error");
    expect((await ctx.service.completeAuthorization({ code: "c", state, cookieState: state })).result).toBe("invalid");
    expect(ctx.oauth.exchangeCode).toHaveBeenCalledTimes(1);
  });

  it("dos callbacks simultáneos con el mismo state: solo uno conecta", async () => {
    const ctx = setup();
    const { state } = await ctx.service.beginAuthorization("u1");
    const results = await Promise.all([
      ctx.service.completeAuthorization({ code: "c", state, cookieState: state }),
      ctx.service.completeAuthorization({ code: "c", state, cookieState: state }),
    ]);
    expect(results.map((r) => r.result).sort()).toEqual(["connected", "invalid"]);
    expect(ctx.oauth.exchangeCode).toHaveBeenCalledTimes(1);
  });
});

describe("aislamiento por usuario", () => {
  it("cada usuario usa solo su propia conexión", async () => {
    const ctx = setup();
    await connect(ctx, "u1");
    await expect(ctx.service.getValidAccessToken("u2")).rejects.toMatchObject({ status: 401, code: "not_connected" });
    expect((await ctx.service.status("u2")).connected).toBe(false);

    await connect(ctx, "u2");
    expect(await ctx.service.getValidAccessToken("u1")).toBe("access-1");
    expect(await ctx.service.getValidAccessToken("u2")).toBe("access-2");

    await ctx.service.disconnect("u1");
    expect((await ctx.service.status("u1")).connected).toBe(false);
    expect(await ctx.service.getValidAccessToken("u2")).toBe("access-2");
  });

  it("un usuario con sesión no puede completar el flujo que inició otro", async () => {
    const ctx = setup();
    const { state } = await ctx.service.beginAuthorization("u1");
    const out = await ctx.service.completeAuthorization({ code: "c", state, cookieState: state, sessionUserId: "u2" });
    expect(out.result).toBe("invalid");
    expect(ctx.connections.size).toBe(0);
    expect(ctx.oauth.exchangeCode).not.toHaveBeenCalled();
  });
});

describe("refresh", () => {
  it("renueva 45 s antes del vencimiento, rota el refresh token y no extiende los 30 días", async () => {
    const ctx = setup();
    await connect(ctx, "u1");
    const before = ctx.connections.get("u1")!;

    ctx.advance(900_000 - 46_000);
    expect(await ctx.service.getValidAccessToken("u1")).toBe("access-1");
    expect(ctx.oauth.refresh).not.toHaveBeenCalled();

    ctx.advance(2_000); // quedan 44 s
    expect(await ctx.service.getValidAccessToken("u1")).toBe("access-2");
    expect(ctx.oauth.refresh).toHaveBeenCalledWith({ refreshToken: "refresh-1", clientId: "client-1" });

    const after = ctx.connections.get("u1")!;
    expect(ctx.cipher.decrypt(after.encryptedRefreshToken)).toBe("refresh-2");
    expect(after.absoluteExpiresAt).toEqual(before.absoluteExpiresAt);
    expect(after.authorizedAt).toEqual(before.authorizedAt);
    expect(ctx.locks.get("u1")).toBeNull();
  });

  it("conserva el refresh token anterior si IOL no manda uno nuevo", async () => {
    const ctx = setup({
      oauth: fakeOAuth({ refresh: vi.fn(async () => ({ accessToken: "a2", refreshToken: null, expiresIn: 900 })) }),
    });
    await connect(ctx, "u1");
    ctx.advance(900_000);
    expect(await ctx.service.getValidAccessToken("u1")).toBe("a2");
    expect(ctx.cipher.decrypt(ctx.connections.get("u1")!.encryptedRefreshToken)).toBe("refresh-1");
  });

  it("renovaciones concurrentes: una sola llamada a IOL y todos reciben el token nuevo", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const oauth = fakeOAuth();
    const slowRefresh = vi.fn(async () => {
      await gate;
      return { accessToken: "fresh", refreshToken: "refresh-new", expiresIn: 900 };
    });
    oauth.refresh = slowRefresh;
    const ctx = setup({ oauth });
    await connect(ctx, "u1");
    ctx.advance(900_000);

    const calls = Promise.all([1, 2, 3].map(() => ctx.service.getValidAccessToken("u1")));
    await new Promise((r) => setTimeout(r, 5));
    release();
    expect(await calls).toEqual(["fresh", "fresh", "fresh"]);
    expect(slowRefresh).toHaveBeenCalledTimes(1);
  });

  it("vence a los 30 días aunque el token se haya renovado", async () => {
    const ctx = setup();
    await connect(ctx, "u1");
    ctx.advance(30 * DAY);
    await expect(ctx.service.getValidAccessToken("u1")).rejects.toMatchObject({ status: 401, code: "expired" });
    expect(ctx.connections.size).toBe(0);
    expect(ctx.oauth.refresh).not.toHaveBeenCalled();
  });

  it("si IOL rechaza el refresh token (400/401) borra la conexión", async () => {
    for (const status of [400, 401]) {
      const ctx = setup({ oauth: fakeOAuth({ refresh: vi.fn(async () => Promise.reject(new IolError(status, "invalid_grant"))) }) });
      await connect(ctx, "u1");
      ctx.advance(900_000);
      await expect(ctx.service.getValidAccessToken("u1")).rejects.toMatchObject({ status: 401, code: "rejected" });
      expect(ctx.connections.size).toBe(0);
    }
  });
});

describe("fallo temporal de IOL", () => {
  it("ante 5xx o timeout conserva la conexión, libera el lock y devuelve un error temporal", async () => {
    for (const err of [new IolError(503, "caído", "temporary"), new IolError(503, "timeout", "temporary"), new Error("ECONNRESET")]) {
      const ctx = setup({ oauth: fakeOAuth({ refresh: vi.fn(async () => Promise.reject(err)) }) });
      await connect(ctx, "u1");
      ctx.advance(900_000);
      await expect(ctx.service.getValidAccessToken("u1")).rejects.toMatchObject({ status: 503, code: "temporary" });
      expect(ctx.connections.has("u1")).toBe(true);
      expect(ctx.locks.get("u1")).toBeNull();
    }
  });

  it("si IOL está caído al canjear el code, informa 'unavailable' sin guardar nada", async () => {
    const ctx = setup({
      oauth: fakeOAuth({ exchangeCode: vi.fn(async () => Promise.reject(new IolError(503, "caído", "temporary"))) }),
    });
    expect((await connect(ctx, "u1")).result).toBe("unavailable");
    expect(ctx.connections.size).toBe(0);
  });

  it("un token que no se puede descifrar (clave rotada) invalida la conexión", async () => {
    const ctx = setup();
    await connect(ctx, "u1");
    ctx.connections.set("u1", { ...ctx.connections.get("u1")!, encryptedAccessToken: "basura" });
    await expect(ctx.service.getValidAccessToken("u1")).rejects.toMatchObject({ status: 401 });
    expect(ctx.connections.size).toBe(0);
  });
});
