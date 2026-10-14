import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NOW_TICK_MS } from "@/constants/moment";
import { createClock } from "./clock";

/*
 * ADR-019, M1: the clock "Adesso" follows. It ticks once a minute, only while somebody listens, and its snapshot
 * stays put between ticks (what `useSyncExternalStore` needs).
 */

let wall = Date.parse("2026-10-14T10:00:00Z");
beforeEach(() => {
  wall = Date.parse("2026-10-14T10:00:00Z");
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

const advance = (ms: number) => {
  wall += ms;
  vi.advanceTimersByTime(ms);
};
const seconds = (iso: string) => Date.parse(iso) / 1000;

describe("the clock of Adesso", () => {
  it("reads the time it is given, in Unix seconds", () => {
    const clock = createClock({ nowMs: () => wall });
    expect(clock.now()).toBe(seconds("2026-10-14T10:00:00Z"));
    wall += 5_000;
    expect(clock.now()).toBe(seconds("2026-10-14T10:00:05Z"));
  });

  it("ticks once a minute while somebody listens, and tells every listener", () => {
    const clock = createClock({ nowMs: () => wall });
    const a = vi.fn();
    const b = vi.fn();
    clock.subscribe(a);
    clock.subscribe(b);
    advance(NOW_TICK_MS - 1);
    expect(a).not.toHaveBeenCalled();
    advance(1);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    advance(3 * NOW_TICK_MS);
    expect(a).toHaveBeenCalledTimes(4);
    expect(clock.getSnapshot()).toBe(seconds("2026-10-14T10:04:00Z"));
  });

  it("keeps the snapshot as it is between ticks, though time passes", () => {
    const clock = createClock({ nowMs: () => wall });
    clock.subscribe(() => {});
    const first = clock.getSnapshot();
    advance(30_000);
    expect(clock.getSnapshot()).toBe(first);
    advance(30_000);
    expect(clock.getSnapshot()).toBe(first + 60);
  });

  it("starts one timer for any number of listeners, and stops it when the last one leaves", () => {
    const set = vi.fn((handler: () => void, ms: number) => setInterval(handler, ms));
    const clear = vi.fn((handle: unknown) => clearInterval(handle as ReturnType<typeof setInterval>));
    const clock = createClock({ nowMs: () => wall, setInterval: set, clearInterval: clear });
    expect(set).not.toHaveBeenCalled();
    const first = clock.subscribe(() => {});
    const second = clock.subscribe(() => {});
    expect(set).toHaveBeenCalledTimes(1);
    first();
    expect(clear).not.toHaveBeenCalled();
    second();
    expect(clear).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not tick, nor change its snapshot, with nobody listening", () => {
    const clock = createClock({ nowMs: () => wall });
    const before = clock.getSnapshot();
    advance(10 * NOW_TICK_MS);
    expect(clock.getSnapshot()).toBe(before);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("brings a stale snapshot up to date when somebody listens again", () => {
    const clock = createClock({ nowMs: () => wall });
    const stop = clock.subscribe(() => {});
    stop();
    advance(2 * 60 * 60_000);
    expect(clock.getSnapshot()).toBe(seconds("2026-10-14T10:00:00Z"));
    clock.subscribe(() => {});
    expect(clock.getSnapshot()).toBe(seconds("2026-10-14T12:00:00Z"));
  });

  it("lets a listener leave twice without harm, and stops telling it", () => {
    const clock = createClock({ nowMs: () => wall });
    const listener = vi.fn();
    const stop = clock.subscribe(listener);
    stop();
    stop();
    advance(NOW_TICK_MS);
    expect(listener).not.toHaveBeenCalled();
  });
});
