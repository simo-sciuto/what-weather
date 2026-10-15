import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POINT_MIN_INTERVAL_MS, QUIET_MS } from "@/constants/atlas";
import type { AtlasPoint, Camera, Cell, PointResult } from "@/types/atlas";
import { cellOf } from "./cell";
import { createAtlasEngine } from "./engine";
import { createFakeCameraPort } from "./fake-camera-port";

/*
 * ADR-022, M4: the controller and the pipeline over a fake port and a fake server. Fake timers, so the quiet and the
 * least interval are exact. Every request the "server" gets is on a list the test reads and answers by hand.
 */

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const at = (lng: number, lat: number): Camera => ({ lng, lat, zoom: 9, pitch: 0, bearing: 0 });
const TORINO = at(7.687, 45.07);
const GENOVA = at(8.93, 44.41);
const MILANO = at(9.19, 45.46);

const pointOf = (cell: Cell, temp = 17): AtlasPoint => ({ cell, timezone: "Europe/Rome", provider: "mock", time: 1_760_000_000, temp, label: "Sereno", condition: "clear", night: false });

type Asked = { cell: Cell; signal: AbortSignal; answer: (result: PointResult) => void };

function rig(options: { minIntervalMs?: number } = {}) {
  const asked: Asked[] = [];
  const onPoint = vi.fn();
  const engine = createAtlasEngine({
    fetchPoint: (cell, signal) => new Promise<PointResult>((resolve) => asked.push({ cell, signal, answer: resolve })),
    onPoint,
    ...options,
  });
  const port = createFakeCameraPort(TORINO);
  port.subscribe((e) => engine.controller.onCamera(e));
  /** Lets the answer reach the pipeline (promises run in microtasks) */
  const answer = async (i: number, result: PointResult) => {
    asked[i].answer(result);
    await vi.advanceTimersByTimeAsync(0);
  };
  return { engine, port, asked, onPoint, answer };
}

describe("a stop asks once, after the quiet, and the answer is the point on show", () => {
  it("asks for nothing while the map moves, then for the cell it rests on", async () => {
    const { port, asked, engine } = rig();
    port.user(GENOVA, { end: false });
    for (let i = 0; i < 200; i++) port.emit("move", "user", at(8 + i / 1000, 44));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(asked).toHaveLength(0);
    port.emit("moveend", "user");
    await vi.advanceTimersByTimeAsync(QUIET_MS - 1);
    expect(asked).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    const rest = port.get();
    expect(asked.map((a) => a.cell)).toEqual([cellOf(rest.lng, rest.lat)]);
    expect(engine.getSnapshot().point).toBeNull();
  });

  it("shows the point only once its answer arrives, and tells the owner (the URL follows it)", async () => {
    const { port, asked, engine, answer, onPoint } = rig();
    port.user(GENOVA);
    await vi.advanceTimersByTimeAsync(QUIET_MS);
    expect(engine.getSnapshot().status.phase).toBe("loading");
    const point = pointOf(asked[0].cell);
    await answer(0, { ok: true, point });
    expect(engine.getSnapshot().point).toBe(point);
    expect(engine.getSnapshot().status).toMatchObject({ phase: "resting", loaded: point.cell, inflight: null });
    expect(onPoint).toHaveBeenCalledTimes(1);
    expect(onPoint).toHaveBeenCalledWith(point);
  });

  it("does not ask again for the point already on show", async () => {
    const { port, asked, answer } = rig();
    port.user(GENOVA);
    await vi.advanceTimersByTimeAsync(QUIET_MS);
    await answer(0, { ok: true, point: pointOf(asked[0].cell) });
    port.user(MILANO);
    port.user(GENOVA);
    await vi.advanceTimersByTimeAsync(QUIET_MS + POINT_MIN_INTERVAL_MS);
    expect(asked).toHaveLength(1);
  });
});

describe("the least interval between two requests", () => {
  it("holds a second request until the interval has passed, counted from the start of the first", async () => {
    const { port, asked, answer } = rig();
    port.user(GENOVA);
    await vi.advanceTimersByTimeAsync(QUIET_MS);
    await answer(0, { ok: true, point: pointOf(asked[0].cell) });
    port.user(MILANO);
    await vi.advanceTimersByTimeAsync(QUIET_MS);
    // The first started at QUIET_MS; the second is ready at 2 * QUIET_MS, and must wait for QUIET_MS + the interval
    expect(asked).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(POINT_MIN_INTERVAL_MS - QUIET_MS - 1);
    expect(asked).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(asked).toHaveLength(2);
    expect(asked[1].cell).toEqual(cellOf(MILANO.lng, MILANO.lat));
  });

  it("drops a held request when the map moves on: only the last stop is asked for", async () => {
    const { port, asked, answer } = rig();
    port.user(GENOVA);
    await vi.advanceTimersByTimeAsync(QUIET_MS);
    await answer(0, { ok: true, point: pointOf(asked[0].cell) });
    port.user(MILANO);
    await vi.advanceTimersByTimeAsync(QUIET_MS);
    expect(asked).toHaveLength(1);
    const third = at(10.5, 43.7);
    port.user(third);
    await vi.advanceTimersByTimeAsync(QUIET_MS + POINT_MIN_INTERVAL_MS);
    expect(asked).toHaveLength(2);
    expect(asked[1].cell).toEqual(cellOf(third.lng, third.lat));
  });

  it("never starts two requests closer than the interval, however the map is moved", async () => {
    const starts: number[] = [];
    const engine = createAtlasEngine({
      fetchPoint: (cell) => {
        starts.push(Date.now());
        return Promise.resolve({ ok: true, point: pointOf(cell) });
      },
    });
    const port = createFakeCameraPort(TORINO);
    port.subscribe((e) => engine.controller.onCamera(e));
    for (let i = 0; i < 40; i++) {
      port.user(at(7 + i * 0.3, 44 + (i % 5) * 0.2));
      await vi.advanceTimersByTimeAsync(QUIET_MS + 50);
    }
    await vi.advanceTimersByTimeAsync(10_000);
    expect(starts.length).toBeGreaterThan(5);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(POINT_MIN_INTERVAL_MS);
  });
});

describe("an answer that is no longer wanted", () => {
  it("aborts the request of a point the person has left, and keeps the previous point on show", async () => {
    const { port, asked, answer, engine } = rig();
    port.user(GENOVA);
    await vi.advanceTimersByTimeAsync(QUIET_MS);
    await answer(0, { ok: true, point: pointOf(asked[0].cell, 15) });
    const first = engine.getSnapshot().point;
    port.user(MILANO);
    await vi.advanceTimersByTimeAsync(POINT_MIN_INTERVAL_MS + QUIET_MS);
    expect(asked).toHaveLength(2);
    // The map moves on while the second point is loading: nothing is dropped until a newer stop asks for another
    port.user(at(11, 43.5));
    expect(asked[1].signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(QUIET_MS + POINT_MIN_INTERVAL_MS);
    expect(asked).toHaveLength(3);
    expect(asked[1].signal.aborted).toBe(true);
    await answer(1, { ok: true, point: pointOf(asked[1].cell, 99) });
    expect(engine.getSnapshot().point).toBe(first);
  });
});

describe("a failure", () => {
  it("keeps the previous point, says why, and Riprova asks for the same cell again", async () => {
    const { port, asked, answer, engine } = rig();
    port.user(GENOVA);
    await vi.advanceTimersByTimeAsync(QUIET_MS);
    await answer(0, { ok: true, point: pointOf(asked[0].cell) });
    const shown = engine.getSnapshot().point;
    port.user(MILANO);
    await vi.advanceTimersByTimeAsync(POINT_MIN_INTERVAL_MS + QUIET_MS);
    await answer(1, { ok: false, reason: "timeout" });
    expect(engine.getSnapshot().point).toBe(shown);
    expect(engine.getSnapshot().status).toMatchObject({ phase: "failed", failed: { cell: asked[1].cell, reason: "timeout" } });
    expect(engine.controller.retry()).toBe(true);
    await vi.advanceTimersByTimeAsync(POINT_MIN_INTERVAL_MS);
    expect(asked).toHaveLength(3);
    expect(asked[2].cell).toEqual(asked[1].cell);
    await answer(2, { ok: true, point: pointOf(asked[2].cell, 21) });
    expect(engine.getSnapshot().point?.temp).toBe(21);
    expect(engine.getSnapshot().status.phase).toBe("resting");
  });

  it("calls the owner for a point only when it was applied, never for a failure", async () => {
    const { port, answer, onPoint } = rig();
    port.user(GENOVA);
    await vi.advanceTimersByTimeAsync(QUIET_MS);
    await answer(0, { ok: false, reason: "upstream" });
    expect(onPoint).not.toHaveBeenCalled();
  });
});

describe("a point asked for on purpose, and the end", () => {
  it("selects with no quiet", async () => {
    const { engine, asked } = rig();
    engine.controller.select({ lat: 45.07, lon: 7.69 });
    await vi.advanceTimersByTimeAsync(0);
    expect(asked).toHaveLength(1);
  });

  it("dispose stops a held request and stops telling anyone", async () => {
    const { port, asked, answer, engine } = rig();
    port.user(GENOVA);
    await vi.advanceTimersByTimeAsync(QUIET_MS);
    await answer(0, { ok: true, point: pointOf(asked[0].cell) });
    port.user(MILANO);
    await vi.advanceTimersByTimeAsync(QUIET_MS);
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.dispose();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(asked).toHaveLength(1);
    expect(listener).not.toHaveBeenCalled();
  });

  it("changes its snapshot only when the status or the point changes", async () => {
    const { port, engine } = rig();
    const seen: unknown[] = [];
    engine.subscribe(() => seen.push(engine.getSnapshot()));
    port.user(GENOVA, { end: false });
    for (let i = 0; i < 300; i++) port.emit("move", "user", at(8 + i / 1000, 44));
    expect(seen).toHaveLength(1);
    expect(engine.getSnapshot()).toBe(seen[0]);
  });
});

describe("never while the map moves, even for a request that was held", () => {
  it("holds a request whose interval ends in the middle of a new movement, and sends it when that movement ends on the same point", async () => {
    const { port, asked, answer } = rig();
    port.user(GENOVA);
    await vi.advanceTimersByTimeAsync(QUIET_MS);
    await answer(0, { ok: true, point: pointOf(asked[0].cell) });
    port.user(MILANO);
    await vi.advanceTimersByTimeAsync(QUIET_MS);
    expect(asked).toHaveLength(1);
    // the person puts a finger down again before the interval is over, and keeps it down past it
    port.emit("movestart", "user");
    await vi.advanceTimersByTimeAsync(POINT_MIN_INTERVAL_MS + 1000);
    expect(asked).toHaveLength(1);
    // and lets go where the map was: the same point, so nothing is asked of another, and the held one goes out after the quiet
    port.emit("moveend", "user");
    await vi.advanceTimersByTimeAsync(QUIET_MS);
    expect(asked).toHaveLength(2);
    expect(asked[1].cell).toEqual(cellOf(MILANO.lng, MILANO.lat));
  });

  it("drops a held request when the movement ends on another point, and asks for that one", async () => {
    const { port, asked, answer } = rig();
    port.user(GENOVA);
    await vi.advanceTimersByTimeAsync(QUIET_MS);
    await answer(0, { ok: true, point: pointOf(asked[0].cell) });
    port.user(MILANO);
    await vi.advanceTimersByTimeAsync(QUIET_MS);
    port.emit("movestart", "user");
    await vi.advanceTimersByTimeAsync(POINT_MIN_INTERVAL_MS + 1000);
    port.emit("moveend", "user", at(11, 43.5));
    await vi.advanceTimersByTimeAsync(QUIET_MS + POINT_MIN_INTERVAL_MS);
    expect(asked).toHaveLength(2);
    expect(asked[1].cell).toEqual(cellOf(11, 43.5));
    expect(asked.filter((a) => !a.signal.aborted)).toHaveLength(2);
  });
});
