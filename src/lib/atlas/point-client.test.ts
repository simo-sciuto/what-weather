import { describe, expect, it, vi } from "vitest";
import type { AtlasPoint } from "@/types/atlas";
import { createPointFetcher, isAtlasPoint } from "./point-client";
import { FIXTURE_SKY } from "./sky.fixture";

/* ADR-022, M4: how the browser asks for a point, and how it tells one failure from another. No network, no server. */

const POINT: AtlasPoint = { cell: { lat: 45.07, lon: 7.69 }, sky: FIXTURE_SKY, timezone: "Europe/Rome", provider: "mock", time: 1_760_000_000, temp: 17.4, label: "Sereno", condition: "clear", night: false };
const CELL = { lat: 45.07, lon: 7.69 };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const live = () => new AbortController().signal;

describe("isAtlasPoint", () => {
  it("accepts a whole point and refuses anything else", () => {
    expect(isAtlasPoint(POINT)).toBe(true);
    expect(isAtlasPoint(null)).toBe(false);
    expect(isAtlasPoint({})).toBe(false);
    expect(isAtlasPoint({ ...POINT, temp: "17" })).toBe(false);
    expect(isAtlasPoint({ ...POINT, temp: Number.NaN })).toBe(false);
    expect(isAtlasPoint({ ...POINT, cell: undefined })).toBe(false);
    expect(isAtlasPoint({ ...POINT, night: "no" })).toBe(false);
    expect(isAtlasPoint({ ...POINT, sky: undefined })).toBe(false);
    expect(isAtlasPoint({ ...POINT, sky: { ...FIXTURE_SKY, sky1: 3 } })).toBe(false);
    expect(isAtlasPoint({ ...POINT, sky: { ...FIXTURE_SKY, sky2: "oklch(0.5 0.1 200)" } })).toBe(false);
    expect(isAtlasPoint({ ...POINT, sky: { ...FIXTURE_SKY, air: { depth: 1 } } })).toBe(false);
  });
});

describe("createPointFetcher", () => {
  it("asks for the cell's coordinates, with the extras, and returns the point", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(json(POINT)));
    const result = await createPointFetcher({ fetchImpl, extra: () => ({ mock: "clear", at: "12:00" }) })(CELL, live());
    expect(result).toEqual({ ok: true, point: POINT });
    const url = new URL(String((fetchImpl.mock.calls[0] as unknown[])[0]), "http://x");
    expect(url.pathname).toBe("/api/atlas/point");
    expect(Object.fromEntries(url.searchParams)).toEqual({ lat: "45.07", lon: "7.69", mock: "clear", at: "12:00" });
  });

  it("a server error is upstream, a refusal is unknown, a wrong shape is upstream", async () => {
    expect(await createPointFetcher({ fetchImpl: () => Promise.resolve(json({ error: "x" }, 502)) })(CELL, live())).toEqual({ ok: false, reason: "upstream" });
    expect(await createPointFetcher({ fetchImpl: () => Promise.resolve(json({ error: "x" }, 400)) })(CELL, live())).toEqual({ ok: false, reason: "unknown" });
    expect(await createPointFetcher({ fetchImpl: () => Promise.resolve(json({ temp: 3 })) })(CELL, live())).toEqual({ ok: false, reason: "upstream" });
  });

  it("a network failure is offline when the browser says so, upstream otherwise", async () => {
    const failing = () => Promise.reject(new TypeError("Failed to fetch"));
    expect(await createPointFetcher({ fetchImpl: failing, online: () => false })(CELL, live())).toEqual({ ok: false, reason: "offline" });
    expect(await createPointFetcher({ fetchImpl: failing, online: () => true })(CELL, live())).toEqual({ ok: false, reason: "upstream" });
  });

  it("a request that takes too long is a timeout", async () => {
    const hang = (_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
    expect(await createPointFetcher({ fetchImpl: hang, timeoutMs: 20 })(CELL, live())).toEqual({ ok: false, reason: "timeout" });
  });

  it("a request the controller has aborted is not a failure to report (its answer is dropped as stale)", async () => {
    const controller = new AbortController();
    const hang = (_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
    const pending = createPointFetcher({ fetchImpl: hang, timeoutMs: 5000 })(CELL, controller.signal);
    controller.abort();
    expect(await pending).toEqual({ ok: false, reason: "unknown" });
  });
});
