import { describe, expect, it } from "vitest";
import { FRESH_FOR_MS, isStale, planRefresh, RETRY_EMPTY_MS, RETRY_ERROR_MS } from "../fundamentals-policy";
import { TokenBucket } from "../rate-limit";

const NOW = new Date("2026-10-07T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("isStale", () => {
  it("vence a las 24 h cuando hay datos", () => {
    expect(isStale({ status: "ok", fetchedAt: ago(FRESH_FOR_MS - 1) }, NOW)).toBe(false);
    expect(isStale({ status: "ok", fetchedAt: ago(FRESH_FOR_MS) }, NOW)).toBe(true);
  });

  it("reintenta antes si el proveedor no tenía datos o falló", () => {
    expect(isStale({ status: "empty", fetchedAt: ago(RETRY_EMPTY_MS) }, NOW)).toBe(true);
    expect(isStale({ status: "error", fetchedAt: ago(RETRY_ERROR_MS) }, NOW)).toBe(true);
    expect(isStale({ status: "error", fetchedAt: ago(RETRY_ERROR_MS - 1) }, NOW)).toBe(false);
  });

  it("lo que no está en la caché siempre hay que bajarlo", () => {
    expect(isStale(undefined, NOW)).toBe(true);
  });
});

describe("planRefresh", () => {
  const cache = new Map([
    ["FRESH", { status: "ok", fetchedAt: ago(1_000) }],
    ["OLD", { status: "ok", fetchedAt: ago(FRESH_FOR_MS * 3) }],
    ["OLDER", { status: "ok", fetchedAt: ago(FRESH_FOR_MS * 5) }],
  ]);

  it("prioriza lo que falta y después lo vencido, del más viejo al más nuevo", () => {
    expect(planRefresh(["FRESH", "OLD", "NEW", "OLDER"], cache, 10, NOW)).toEqual(["NEW", "OLDER", "OLD"]);
  });

  it("respeta el tope de descargas", () => {
    expect(planRefresh(["OLD", "NEW", "OLDER"], cache, 2, NOW)).toEqual(["NEW", "OLDER"]);
    expect(planRefresh(["NEW"], cache, 0, NOW)).toEqual([]);
  });

  it("no repite símbolos ni baja lo que está vigente", () => {
    expect(planRefresh(["FRESH", "FRESH"], cache, 10, NOW)).toEqual([]);
    expect(planRefresh(["NEW", "NEW"], cache, 10, NOW)).toEqual(["NEW"]);
  });
});

describe("TokenBucket", () => {
  it("permite una ráfaga hasta la capacidad y después corta", () => {
    let t = 0;
    const bucket = new TokenBucket(3, 3_000, () => t);
    expect([bucket.tryTake(), bucket.tryTake(), bucket.tryTake(), bucket.tryTake()]).toEqual([true, true, true, false]);
    t = 1_000; // se repone un permiso por segundo
    expect(bucket.tryTake()).toBe(true);
    expect(bucket.tryTake()).toBe(false);
  });

  it("nunca acumula más que la capacidad", () => {
    let t = 0;
    const bucket = new TokenBucket(2, 1_000, () => t);
    t = 1_000_000;
    expect(bucket.available()).toBe(2);
  });

  it("take() espera el tiempo justo y atiende en orden", async () => {
    let t = 0;
    const waits: number[] = [];
    const bucket = new TokenBucket(1, 1_000, () => t, async (ms) => {
      waits.push(ms);
      t += ms;
    });
    const order: number[] = [];
    await Promise.all([1, 2, 3].map((n) => bucket.take().then(() => order.push(n))));
    expect(order).toEqual([1, 2, 3]);
    expect(waits).toEqual([1_000, 1_000]);
  });
});
