import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POINT_MIN_INTERVAL_MS, QUIET_MS } from "@/constants/atlas";
import type { Bounds, Camera, WeatherField } from "@/types/atlas";
import { createFieldLoader } from "./field-loader";
import { latticeFor, viewBounds } from "./lattice";

/* ADR-026: when the weather field is asked for. Fake timers, a fake server, a fake size. */

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const SIZE = { width: 1440, height: 900 };
const at = (lng: number, lat: number, zoom = 8): Camera => ({ lng, lat, zoom, pitch: 0, bearing: 0 });
const TORINO = at(7.687, 45.07);
const ROMA = at(12.48, 41.89);
const fieldOf = (b: Bounds): WeatherField => ({ ...latticeFor(b), provider: "mock", time: 1, colors: ["#000000"], temps: [0] });

type Asked = { bounds: Bounds; signal: AbortSignal; answer: (f: WeatherField | null) => void; fail: () => void };

function rig() {
  const asked: Asked[] = [];
  const shown: WeatherField[] = [];
  const loader = createFieldLoader({
    fetchField: (bounds, signal) => new Promise((resolve, reject) => asked.push({ bounds, signal, answer: resolve, fail: () => reject(new Error("x")) })),
    size: () => SIZE,
    onField: (f) => shown.push(f),
  });
  const stop = (camera: Camera) => {
    loader.onCamera({ type: "movestart", camera, origin: "user" });
    loader.onCamera({ type: "moveend", camera, origin: "user" });
  };
  const answer = async (i: number, f?: WeatherField | null) => {
    asked[i].answer(f === undefined ? fieldOf(asked[i].bounds) : f);
    await vi.advanceTimersByTimeAsync(0);
  };
  return { loader, asked, shown, stop, answer };
}

describe("when the field is asked for", () => {
  it("asks for nothing while the map moves, and once after the quiet, for the view it rests on", async () => {
    const { loader, asked, stop } = rig();
    loader.onCamera({ type: "movestart", camera: TORINO, origin: "user" });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(asked).toHaveLength(0);
    stop(ROMA);
    await vi.advanceTimersByTimeAsync(QUIET_MS - 1);
    expect(asked).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(asked).toHaveLength(1);
    expect(asked[0].bounds).toEqual(viewBounds(ROMA, SIZE));
  });

  it("starts at once for the first view, with no movement to wait for", () => {
    const { loader, asked } = rig();
    loader.start(TORINO);
    expect(asked).toHaveLength(1);
  });

  it("shows the field when it arrives, and not a field for a view the person has left", async () => {
    const { loader, asked, shown, stop, answer } = rig();
    loader.start(TORINO);
    stop(ROMA);
    await vi.advanceTimersByTimeAsync(QUIET_MS + POINT_MIN_INTERVAL_MS);
    expect(asked).toHaveLength(2);
    expect(asked[0].signal.aborted).toBe(true);
    await answer(0);
    expect(shown).toHaveLength(0);
    await answer(1);
    expect(shown).toHaveLength(1);
    expect(shown[0].lats[0]).toBeLessThanOrEqual(viewBounds(ROMA, SIZE).south);
  });

  it("asks for nothing when the view needs the places already on show: a nudge, and a request in flight", async () => {
    const { loader, asked, stop, answer } = rig();
    loader.start(TORINO);
    stop(at(7.69, 45.071));
    await vi.advanceTimersByTimeAsync(QUIET_MS + POINT_MIN_INTERVAL_MS);
    expect(asked).toHaveLength(1);
    await answer(0);
    stop(at(7.7, 45.08));
    await vi.advanceTimersByTimeAsync(QUIET_MS + POINT_MIN_INTERVAL_MS);
    expect(asked).toHaveLength(1);
  });

  it("asks again for another view, once the interval has passed, and never closer than it", async () => {
    const { loader, asked, stop, answer } = rig();
    loader.start(TORINO);
    await answer(0);
    stop(ROMA);
    await vi.advanceTimersByTimeAsync(QUIET_MS);
    // the first request started at 0: the second may start at the interval, not at the quiet
    expect(asked).toHaveLength(POINT_MIN_INTERVAL_MS > QUIET_MS ? 1 : 2);
    await vi.advanceTimersByTimeAsync(POINT_MIN_INTERVAL_MS);
    expect(asked).toHaveLength(2);
  });

  it("keeps the field on show on a failure, and tries again at the next stop, not by itself", async () => {
    const { loader, asked, shown, stop } = rig();
    loader.start(TORINO);
    asked[0].fail();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(shown).toHaveLength(0);
    expect(asked).toHaveLength(1);
    stop(TORINO);
    await vi.advanceTimersByTimeAsync(QUIET_MS + POINT_MIN_INTERVAL_MS);
    expect(asked).toHaveLength(2);
  });

  it("shows nothing for a null answer, and a field again the next time", async () => {
    const { loader, asked, shown, answer } = rig();
    loader.start(TORINO);
    await answer(0, null);
    expect(shown).toHaveLength(0);
    loader.start(TORINO);
    await vi.advanceTimersByTimeAsync(POINT_MIN_INTERVAL_MS);
    expect(asked).toHaveLength(2);
  });

  it("stops waiting and asking when it is disposed", async () => {
    const { loader, asked, shown, stop, answer } = rig();
    loader.start(TORINO);
    stop(ROMA);
    loader.dispose();
    expect(asked[0].signal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(asked).toHaveLength(1);
    await answer(0);
    expect(shown).toHaveLength(0);
  });
});

describe("refresh (WTH-359)", () => {
  it("asks again for the view on show, but not over a request in flight", async () => {
    const { loader, asked, answer } = rig();
    loader.start(TORINO);
    loader.refresh(TORINO);
    expect(asked).toHaveLength(1);
    await answer(0);
    loader.refresh(TORINO);
    // the least interval between two requests holds for a refresh too
    await vi.advanceTimersByTimeAsync(60_000);
    expect(asked).toHaveLength(2);
    expect(asked[1].bounds).toEqual(asked[0].bounds);
  });
});
