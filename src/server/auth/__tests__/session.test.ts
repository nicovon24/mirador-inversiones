import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookie: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  deleteMany: vi.fn(),
  transaction: vi.fn(),
  configured: vi.fn(() => true),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookie }) }));
vi.mock("react", () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }));
vi.mock("@/lib/db", () => ({ db: {
  session: { findUnique: mocks.findUnique },
  $transaction: mocks.transaction,
} }));
vi.mock("../google-oidc", () => ({ getGoogleConfig: mocks.configured }));

import { createSession, getCurrentUser } from "../session";
import { sha256Hex } from "@/lib/security/crypto";

const token = "A".repeat(43);
const validUser = {
  id: "user-1",
  email: "fervon96@gmail.com",
  role: "USER",
  identityType: "AUTHENTICATED",
  googleSub: "google-sub-1",
};

describe("Mirador sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configured.mockReturnValue(true);
    mocks.cookie.mockReturnValue({ value: token });
    mocks.findUnique.mockResolvedValue({ expiresAt: new Date(Date.now() + 60_000), user: validUser });
    mocks.create.mockResolvedValue({ id: "created" });
    mocks.deleteMany.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (work: (tx: { session: {
      create: typeof mocks.create;
      deleteMany: typeof mocks.deleteMany;
    } }) => Promise<unknown>) => work({ session: { create: mocks.create, deleteMany: mocks.deleteMany } }));
  });

  it("rejects pre-login anonymous identities even when their old cookie and DB session are valid", async () => {
    mocks.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user: { ...validUser, identityType: "LEGACY_ANONYMOUS", googleSub: null, email: null },
    });
    expect(await getCurrentUser()).toBeNull();
  });

  it("requires the account to remain on the exact allowlist for every request", async () => {
    mocks.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user: { ...validUser, email: "other@gmail.com" },
    });
    expect(await getCurrentUser()).toBeNull();
  });

  it("fails closed when Google login configuration is missing", async () => {
    mocks.configured.mockReturnValue(false);
    expect(await getCurrentUser()).toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("accepts only an unexpired authenticated account", async () => {
    expect(await getCurrentUser()).toEqual({ id: "user-1", email: "fervon96@gmail.com", role: "USER" });
    mocks.findUnique.mockResolvedValue({ expiresAt: new Date(Date.now() - 1), user: validUser });
    expect(await getCurrentUser()).toBeNull();
  });

  it("rotates the previous browser session when switching Google accounts", async () => {
    const result = await createSession("user-2", token);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.create).toHaveBeenCalledWith({ data: {
      id: sha256Hex(result.token), userId: "user-2", expiresAt: result.expiresAt,
    } });
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: sha256Hex(token) } });
    expect(mocks.create.mock.invocationCallOrder[0]).toBeLessThan(mocks.deleteMany.mock.invocationCallOrder[0]);
  });

  it("keeps the previous session if issuing the replacement fails", async () => {
    mocks.create.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(createSession("user-2", token)).rejects.toThrow("database unavailable");
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });
});
