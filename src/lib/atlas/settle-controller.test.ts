import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QUIET_MS } from "@/constants/atlas";
import type { AtlasStatus, Camera, CommitRequest } from "@/types/atlas";
import { cellOf } from "./cell";
import { createFakeCameraPort } from "./fake-camera-port";
import { createSettleController } from "./settle-controller";

/*
 * ADR-020, M2: the controller with fake timers and a fake camera port. Nothing here touches the weather, the router,
 * React or a map: the owner of the controller is the test, which answers the requests.
 */

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const at = (lng: number, lat: number): Camera => ({ lng, lat, zoom: 9, pitch: 0, bearing: 0 });
const TORINO = at(7.687, 45.07);
const GENOVA = at(8.93, 44.41);
const MILANO = at(9.19, 45.46);

function rig(options: { quietMs?: number } = {}) {
  const requests: CommitRequest[] = [];
  const controller = createSettleController({ onCommit: (r) => requests.push(r), ...options });
  const statuses: AtlasStatus[] = [];
  controller.subscribe((s) => statuses.push(s));
  const port = createFakeCameraPort(TORINO);
  port.subscribe((e) => controller.onCamera(e));
  const phases = () => statuses.map((s) => s.phase);
  /** The person moves the map to `to` and lets go */
  const user = (to: Camera) => port.user(to);
  return { controller, requests, statuses, port, phases, user };
}

describe("no request while the map moves", () => {
  it("asks for nothing however long and far the map is moved, and changes the status once, not per frame", () => {
    const { controller, requests, port, statuses } = rig();
    port.user(GENOVA, { end: false });
    for (let i = 0; i < 500; i++) port.emit("move", "user", at(8 + i / 1000, 44 + i / 1000));
    vi.advanceTimersByTime(60_000);
    expect(requests).toHaveLength(0);
    expect(controller.getStatus().phase).toBe("moving");
    expect(statuses).toHaveLength(1);
  });

  it("never hears the frames of a movement when it listens as the page will", () => {
    const { port } = rig();
    expect(port.listenerCounts()).toEqual({ all: 1, frames: 0 });
  });
});

describe("the quiet", () => {
  it("starts at the end of the movement, and asks for the point the map rests on when it is over", () => {
    const { controller, requests, user } = rig();
    user(GENOVA);
    expect(controller.getStatus()).toMatchObject({ phase: "settling", candidate: null });
    vi.advanceTimersByTime(QUIET_MS - 1);
    expect(requests).toHaveLength(0);
    expect(controller.getStatus().phase).toBe("settling");
    vi.advanceTimersByTime(1);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ seq: 1, reason: "settle", cell: cellOf(GENOVA.lng, GENOVA.lat) });
    expect(requests[0].signal.aborted).toBe(false);
    expect(controller.getStatus()).toMatchObject({ phase: "loading", candidate: cellOf(GENOVA.lng, GENOVA.lat), inflight: cellOf(GENOVA.lng, GENOVA.lat) });
  });

  it("is counted from the end of the movement, not from its start", () => {
    const { requests, port } = rig({ quietMs: 1000 });
    port.user(GENOVA, { end: false });
    vi.advanceTimersByTime(5000);
    port.emit("moveend", "user");
    vi.advanceTimersByTime(999);
    expect(requests).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(requests).toHaveLength(1);
  });

  it("is cancelled by a new movement, and starts over, from nothing, at its end", () => {
    const { controller, requests, port, user } = rig();
    user(GENOVA);
    vi.advanceTimersByTime(500);
    port.user(MILANO, { end: false });
    expect(controller.getStatus().phase).toBe("moving");
    vi.advanceTimersByTime(10_000);
    expect(requests).toHaveLength(0);
    port.emit("moveend", "user");
    vi.advanceTimersByTime(QUIET_MS - 1);
    expect(requests).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(requests).toHaveLength(1);
    expect(requests[0].cell).toEqual(cellOf(MILANO.lng, MILANO.lat));
  });

  it("asks for the point of the last settle only, of any number of movements", () => {
    const { requests, user } = rig();
    for (const to of [GENOVA, MILANO, TORINO, GENOVA]) {
      user(to);
      vi.advanceTimersByTime(QUIET_MS / 2);
    }
    vi.advanceTimersByTime(QUIET_MS);
    expect(requests).toHaveLength(1);
    expect(requests[0].cell).toEqual(cellOf(GENOVA.lng, GENOVA.lat));
  });

  it("has no candidate until the map has settled", () => {
    const { controller, user } = rig();
    expect(controller.getStatus().candidate).toBeNull();
    user(GENOVA);
    expect(controller.getStatus().candidate).toBeNull();
    vi.advanceTimersByTime(QUIET_MS);
    expect(controller.getStatus().candidate).not.toBeNull();
  });

  it("takes its length from the options", () => {
    const { requests, user } = rig({ quietMs: 120 });
    user(GENOVA);
    vi.advanceTimersByTime(119);
    expect(requests).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(requests).toHaveLength(1);
  });
});

describe("the same cell is not asked for twice", () => {
  it("asks for nothing when the map settles within the cell already on show", () => {
    const { controller, requests, user } = rig();
    controller.markLoaded(cellOf(TORINO.lng, TORINO.lat));
    user(at(7.6879, 45.0702));
    vi.advanceTimersByTime(QUIET_MS);
    expect(requests).toHaveLength(0);
    expect(controller.getStatus()).toMatchObject({ phase: "resting", candidate: cellOf(TORINO.lng, TORINO.lat) });
  });

  it("asks once when the map settles again within the cell that is being asked for", () => {
    const { controller, requests, user } = rig();
    user(GENOVA);
    vi.advanceTimersByTime(QUIET_MS);
    user(at(GENOVA.lng + 0.001, GENOVA.lat - 0.001));
    vi.advanceTimersByTime(QUIET_MS);
    expect(requests).toHaveLength(1);
    expect(controller.getStatus().phase).toBe("loading");
  });

  it("drops what is on its way when the map comes back to the point on show", () => {
    const { controller, requests, user } = rig();
    controller.markLoaded(cellOf(TORINO.lng, TORINO.lat));
    user(GENOVA);
    vi.advanceTimersByTime(QUIET_MS);
    expect(requests).toHaveLength(1);
    user(TORINO);
    vi.advanceTimersByTime(QUIET_MS);
    expect(requests).toHaveLength(1);
    expect(requests[0].signal.aborted).toBe(true);
    expect(controller.getStatus()).toMatchObject({ phase: "resting", inflight: null, loaded: cellOf(TORINO.lng, TORINO.lat) });
    expect(controller.resolve(requests[0].seq, { ok: true })).toBe("stale");
    expect(controller.getStatus().loaded).toEqual(cellOf(TORINO.lng, TORINO.lat));
  });
});

describe("answers that come late", () => {
  it("aborts the older request when a newer one is made, and does not let its answer in", () => {
    const { controller, requests, user } = rig();
    user(GENOVA);
    vi.advanceTimersByTime(QUIET_MS);
    user(MILANO);
    vi.advanceTimersByTime(QUIET_MS);
    expect(requests.map((r) => r.seq)).toEqual([1, 2]);
    expect(requests[0].signal.aborted).toBe(true);
    expect(requests[1].signal.aborted).toBe(false);
    expect(controller.resolve(1, { ok: true })).toBe("stale");
    expect(controller.getStatus().loaded).toBeNull();
    expect(controller.resolve(2, { ok: true })).toBe("applied");
    expect(controller.getStatus()).toMatchObject({ phase: "resting", loaded: cellOf(MILANO.lng, MILANO.lat), inflight: null });
  });

  it("does not let a stale failure in either", () => {
    const { controller, requests, user } = rig();
    user(GENOVA);
    vi.advanceTimersByTime(QUIET_MS);
    user(MILANO);
    vi.advanceTimersByTime(QUIET_MS);
    expect(controller.resolve(1, { ok: false, reason: "timeout" })).toBe("stale");
    expect(controller.getStatus().failed).toBeNull();
    expect(requests).toHaveLength(2);
  });

  it("does not answer twice: a second answer to the same request is stale", () => {
    const { controller, requests, user } = rig();
    user(GENOVA);
    vi.advanceTimersByTime(QUIET_MS);
    expect(controller.resolve(requests[0].seq, { ok: true })).toBe("applied");
    expect(controller.resolve(requests[0].seq, { ok: false, reason: "upstream" })).toBe("stale");
    expect(controller.getStatus().failed).toBeNull();
  });

  it("applies an answer that arrives while the map moves, without disturbing the movement", () => {
    const { controller, requests, port, user } = rig();
    user(GENOVA);
    vi.advanceTimersByTime(QUIET_MS);
    port.user(MILANO, { end: false });
    expect(controller.resolve(requests[0].seq, { ok: true })).toBe("applied");
    expect(controller.getStatus()).toMatchObject({ phase: "moving", loaded: cellOf(GENOVA.lng, GENOVA.lat) });
  });

  it("numbers requests so that they only grow, whatever supersedes what", () => {
    const { controller, requests, user } = rig();
    controller.markLoaded(cellOf(TORINO.lng, TORINO.lat));
    for (const to of [GENOVA, TORINO, MILANO, TORINO, GENOVA]) {
      user(to);
      vi.advanceTimersByTime(QUIET_MS);
    }
    const seqs = requests.map((r) => r.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(new Set(seqs).size).toBe(seqs.length);
  });
});

describe("a failure", () => {
  it("is kept with the point that failed, leaves the weather on show alone, and is never retried alone", () => {
    const { controller, requests, user } = rig();
    controller.markLoaded(cellOf(TORINO.lng, TORINO.lat));
    user(GENOVA);
    vi.advanceTimersByTime(QUIET_MS);
    controller.resolve(requests[0].seq, { ok: false, reason: "upstream" });
    expect(controller.getStatus()).toMatchObject({
      phase: "failed",
      loaded: cellOf(TORINO.lng, TORINO.lat),
      inflight: null,
      failed: { cell: cellOf(GENOVA.lng, GENOVA.lat), reason: "upstream" },
    });
    vi.advanceTimersByTime(10 * 60_000);
    expect(requests).toHaveLength(1);
  });

  it("is retried on purpose, once for each press, with the point that failed", () => {
    const { controller, requests, user } = rig();
    user(GENOVA);
    vi.advanceTimersByTime(QUIET_MS);
    controller.resolve(1, { ok: false, reason: "timeout" });
    expect(controller.retry()).toBe(true);
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({ seq: 2, reason: "retry", cell: cellOf(GENOVA.lng, GENOVA.lat) });
    expect(controller.getStatus()).toMatchObject({ phase: "loading", failed: null });
    controller.resolve(2, { ok: true });
    expect(controller.getStatus()).toMatchObject({ phase: "resting", loaded: cellOf(GENOVA.lng, GENOVA.lat), failed: null });
  });

  it("has nothing to retry unless something failed and is showing", () => {
    const { controller, requests, user } = rig();
    expect(controller.retry()).toBe(false);
    user(GENOVA);
    vi.advanceTimersByTime(QUIET_MS);
    expect(controller.retry()).toBe(false);
    expect(requests).toHaveLength(1);
  });

  it("lets the person go on exploring: a new settle asks for the new point and clears the failure", () => {
    const { controller, requests, port, user } = rig();
    user(GENOVA);
    vi.advanceTimersByTime(QUIET_MS);
    controller.resolve(1, { ok: false, reason: "offline" });
    port.user(MILANO, { end: false });
    expect(controller.getStatus()).toMatchObject({ phase: "moving", failed: { reason: "offline" } });
    port.emit("moveend", "user");
    vi.advanceTimersByTime(QUIET_MS);
    expect(requests).toHaveLength(2);
    expect(controller.getStatus()).toMatchObject({ phase: "loading", failed: null });
    user(GENOVA);
    controller.resolve(2, { ok: true });
    vi.advanceTimersByTime(QUIET_MS);
    expect(requests).toHaveLength(3);
  });

  it("keeps a failure that arrives while the map moves, and clears it when the map settles on the point on show", () => {
    const { controller, requests, port, user } = rig();
    controller.markLoaded(cellOf(TORINO.lng, TORINO.lat));
    user(GENOVA);
    vi.advanceTimersByTime(QUIET_MS);
    port.user(TORINO, { end: false });
    controller.resolve(requests[0].seq, { ok: false, reason: "upstream" });
    expect(controller.getStatus()).toMatchObject({ phase: "moving", failed: { reason: "upstream" } });
    port.emit("moveend", "user");
    vi.advanceTimersByTime(QUIET_MS);
    expect(controller.getStatus()).toMatchObject({ phase: "resting", failed: null });
    expect(requests).toHaveLength(1);
  });
});

describe("the code's own moves", () => {
  it("never start a quiet, and do not change the status", () => {
    const { controller, requests, port, statuses } = rig();
    port.jumpTo(GENOVA);
    port.flyTo(MILANO);
    port.setPadding({ bottom: 120 });
    vi.advanceTimersByTime(60_000);
    expect(requests).toHaveLength(0);
    expect(statuses).toHaveLength(0);
    expect(controller.getStatus().phase).toBe("resting");
  });

  it("cancel a quiet that is running: the map is no longer where the person left it", () => {
    const { controller, requests, port, user } = rig();
    user(GENOVA);
    vi.advanceTimersByTime(QUIET_MS / 2);
    port.jumpTo(MILANO);
    expect(controller.getStatus().phase).toBe("resting");
    vi.advanceTimersByTime(60_000);
    expect(requests).toHaveLength(0);
  });

  it("cancel a quiet even when only their end was heard", () => {
    const { controller, requests, port, user } = rig();
    user(GENOVA);
    port.emit("moveend", "program", MILANO);
    expect(controller.getStatus().phase).toBe("resting");
    vi.advanceTimersByTime(60_000);
    expect(requests).toHaveLength(0);
  });

  it("do not turn a person's loading into anything else", () => {
    const { controller, user, port } = rig();
    user(GENOVA);
    vi.advanceTimersByTime(QUIET_MS);
    port.jumpTo(MILANO);
    expect(controller.getStatus().phase).toBe("loading");
  });
});

describe("a point picked on purpose", () => {
  it("is asked for at once, without the quiet, and cancels one that is running", () => {
    const { controller, requests, user } = rig();
    user(GENOVA);
    controller.select(cellOf(MILANO.lng, MILANO.lat));
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ reason: "select", cell: cellOf(MILANO.lng, MILANO.lat) });
    vi.advanceTimersByTime(60_000);
    expect(requests).toHaveLength(1);
    expect(controller.getStatus()).toMatchObject({ phase: "loading", candidate: cellOf(MILANO.lng, MILANO.lat) });
  });

  it("asks for nothing when it is the point on show or the one being asked for", () => {
    const { controller, requests } = rig();
    controller.markLoaded(cellOf(TORINO.lng, TORINO.lat));
    controller.select(cellOf(TORINO.lng, TORINO.lat));
    expect(requests).toHaveLength(0);
    controller.select(cellOf(GENOVA.lng, GENOVA.lat));
    controller.select(cellOf(GENOVA.lng, GENOVA.lat));
    expect(requests).toHaveLength(1);
  });

  it("supersedes a request that is on its way", () => {
    const { controller, requests } = rig();
    controller.select(cellOf(GENOVA.lng, GENOVA.lat));
    controller.select(cellOf(MILANO.lng, MILANO.lat));
    expect(requests[0].signal.aborted).toBe(true);
    expect(controller.resolve(1, { ok: true })).toBe("stale");
  });
});

describe("the point on show", () => {
  it("is set by the owner, and completes a request for the same point", () => {
    const { controller, requests, user } = rig();
    user(GENOVA);
    vi.advanceTimersByTime(QUIET_MS);
    controller.markLoaded(cellOf(GENOVA.lng, GENOVA.lat));
    expect(controller.getStatus()).toMatchObject({ phase: "resting", loaded: cellOf(GENOVA.lng, GENOVA.lat), inflight: null });
    expect(controller.resolve(requests[0].seq, { ok: true })).toBe("stale");
  });

  it("clears a failure of that same point", () => {
    const { controller, user } = rig();
    user(GENOVA);
    vi.advanceTimersByTime(QUIET_MS);
    controller.resolve(1, { ok: false, reason: "upstream" });
    controller.markLoaded(cellOf(GENOVA.lng, GENOVA.lat));
    expect(controller.getStatus()).toMatchObject({ phase: "resting", failed: null });
  });
});

describe("the status as the page will read it", () => {
  it("is told of a change only when there is one, and each time with a new object", () => {
    const { controller, statuses, user } = rig();
    const listener = vi.fn();
    const stop = controller.subscribe(listener);
    user(GENOVA);
    expect(listener).toHaveBeenCalledTimes(2); // moving, settling
    vi.advanceTimersByTime(QUIET_MS);
    expect(listener).toHaveBeenCalledTimes(3); // loading
    controller.markLoaded(cellOf(GENOVA.lng, GENOVA.lat));
    expect(listener).toHaveBeenCalledTimes(4);
    controller.markLoaded(cellOf(GENOVA.lng, GENOVA.lat)); // the same again: nothing
    expect(listener).toHaveBeenCalledTimes(4);
    stop();
    user(MILANO);
    expect(listener).toHaveBeenCalledTimes(4);
    const seen = new Set(statuses);
    expect(seen.size).toBe(statuses.length);
  });

  it("goes through the phases of a whole exploration in order", () => {
    const { controller, requests, phases, user } = rig();
    user(GENOVA);
    vi.advanceTimersByTime(QUIET_MS);
    controller.resolve(requests[0].seq, { ok: true });
    expect(phases()).toEqual(["moving", "settling", "loading", "resting"]);
  });
});

describe("shutting down", () => {
  it("stops the quiet, aborts what is on its way, and says nothing more", () => {
    const { controller, requests, user, statuses } = rig();
    user(GENOVA);
    vi.advanceTimersByTime(QUIET_MS);
    user(MILANO);
    const seen = statuses.length;
    controller.dispose();
    vi.advanceTimersByTime(60_000);
    expect(requests[0].signal.aborted).toBe(true);
    expect(requests).toHaveLength(1);
    expect(statuses).toHaveLength(seen);
  });
});

describe("Riprova, the person still exploring", () => {
  it("asks again for the point that failed while the map moves, and the person keeps their phase", () => {
    const { controller, requests, port, user } = rig();
    user(GENOVA);
    vi.advanceTimersByTime(QUIET_MS);
    controller.resolve(1, { ok: false, reason: "offline" });
    port.user(MILANO, { end: false });
    expect(controller.retry()).toBe(true);
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({ reason: "retry", cell: cellOf(GENOVA.lng, GENOVA.lat) });
    expect(controller.getStatus()).toMatchObject({ phase: "moving", inflight: cellOf(GENOVA.lng, GENOVA.lat), failed: null });
    controller.resolve(2, { ok: true });
    expect(controller.getStatus()).toMatchObject({ phase: "moving", loaded: cellOf(GENOVA.lng, GENOVA.lat) });
  });

  it("asks again during the quiet too, which then runs on and settles where the map rests", () => {
    const { controller, requests, port, user } = rig();
    user(GENOVA);
    vi.advanceTimersByTime(QUIET_MS);
    controller.resolve(1, { ok: false, reason: "upstream" });
    port.user(MILANO);
    expect(controller.getStatus().phase).toBe("settling");
    expect(controller.retry()).toBe(true);
    expect(controller.getStatus().phase).toBe("settling");
    vi.advanceTimersByTime(QUIET_MS);
    expect(requests.map((r) => r.reason)).toEqual(["settle", "retry", "settle"]);
    expect(requests[1].signal.aborted).toBe(true);
    expect(controller.getStatus()).toMatchObject({ phase: "loading", inflight: cellOf(MILANO.lng, MILANO.lat) });
  });

  it("asks again for the point that failed when the person settles on it again: their own new attempt", () => {
    const { controller, requests, user } = rig();
    user(GENOVA);
    vi.advanceTimersByTime(QUIET_MS);
    controller.resolve(1, { ok: false, reason: "timeout" });
    user(MILANO);
    vi.advanceTimersByTime(QUIET_MS);
    controller.resolve(2, { ok: false, reason: "timeout" });
    user(GENOVA);
    vi.advanceTimersByTime(QUIET_MS);
    expect(requests.map((r) => r.reason)).toEqual(["settle", "settle", "settle"]);
    expect(controller.getStatus()).toMatchObject({ phase: "loading", failed: null });
  });
});

describe("a point picked while the map moves", () => {
  it("is asked for at once and the person keeps their phase", () => {
    const { controller, requests, port } = rig();
    port.user(GENOVA, { end: false });
    controller.select(cellOf(MILANO.lng, MILANO.lat));
    expect(requests).toHaveLength(1);
    expect(controller.getStatus()).toMatchObject({ phase: "moving", inflight: cellOf(MILANO.lng, MILANO.lat) });
  });

  it("takes the place of a quiet that was running, and the status shows the request", () => {
    const { controller, requests, user } = rig();
    user(GENOVA);
    controller.select(cellOf(MILANO.lng, MILANO.lat));
    expect(controller.getStatus().phase).toBe("loading");
    vi.advanceTimersByTime(QUIET_MS * 3);
    expect(requests).toHaveLength(1);
  });
});

describe("movements seen out of order", () => {
  it("settles after a person's moveend with no movestart before it", () => {
    const { controller, requests, port } = rig();
    port.emit("moveend", "user", GENOVA);
    expect(controller.getStatus().phase).toBe("settling");
    vi.advanceTimersByTime(QUIET_MS);
    expect(requests).toHaveLength(1);
    expect(requests[0].cell).toEqual(cellOf(GENOVA.lng, GENOVA.lat));
  });

  it("starts the quiet over at a second moveend, and asks for the point of the last", () => {
    const { requests, port } = rig();
    port.emit("moveend", "user", GENOVA);
    vi.advanceTimersByTime(QUIET_MS - 100);
    port.emit("moveend", "user", MILANO);
    vi.advanceTimersByTime(QUIET_MS - 1);
    expect(requests).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(requests).toHaveLength(1);
    expect(requests[0].cell).toEqual(cellOf(MILANO.lng, MILANO.lat));
  });

  it("puts the weather of another point on show while one is on its way, without ending the request", () => {
    const { controller, user } = rig();
    user(GENOVA);
    vi.advanceTimersByTime(QUIET_MS);
    controller.markLoaded(cellOf(TORINO.lng, TORINO.lat));
    expect(controller.getStatus()).toMatchObject({
      phase: "loading",
      loaded: cellOf(TORINO.lng, TORINO.lat),
      inflight: cellOf(GENOVA.lng, GENOVA.lat),
    });
  });
});

describe("a request that cannot be made", () => {
  it("is a failure, not a request left waiting for an answer", () => {
    const controller = createSettleController({
      onCommit: () => {
        throw new Error("no way to ask");
      },
    });
    controller.select(cellOf(GENOVA.lng, GENOVA.lat));
    expect(controller.getStatus()).toMatchObject({ phase: "failed", inflight: null, failed: { reason: "unknown" } });
    expect(controller.retry()).toBe(true);
    expect(controller.getStatus()).toMatchObject({ phase: "failed", failed: { reason: "unknown" } });
  });
});

describe("after shutting down", () => {
  it("does nothing for a late camera event, a pick, a retry or an answer", () => {
    const { controller, requests, port, user } = rig();
    user(GENOVA);
    vi.advanceTimersByTime(QUIET_MS);
    controller.resolve(1, { ok: false, reason: "upstream" });
    controller.dispose();
    port.user(MILANO);
    vi.advanceTimersByTime(60_000);
    controller.select(cellOf(TORINO.lng, TORINO.lat));
    expect(controller.retry()).toBe(false);
    expect(controller.resolve(1, { ok: true })).toBe("stale");
    controller.markLoaded(cellOf(MILANO.lng, MILANO.lat));
    expect(requests).toHaveLength(1);
    expect(controller.getStatus().loaded).toBeNull();
  });
});

describe("a flight of the code that the person interrupts (regression, pre-M3)", () => {
  const DESTINATION = at(9.5, 45.6);
  const MID_AIR = at(8.226, 45.228);
  const WHERE_IT_STOPS = at(8.018, 45.277);

  it("asks for where the map comes to rest, not for the flight's destination nor for where the flight was cut", () => {
    const { controller, requests, port } = rig();
    // The code starts a flight; the person takes hold of the map in mid-air: the flight ends where it was cut, as the
    // code's, then the person's movement begins and ends (the order Mapbox 3.31 gave in a real browser, M3 pre-check)
    port.emit("movestart", "program");
    expect(controller.getStatus().phase).toBe("resting");
    port.emit("moveend", "program", MID_AIR);
    expect(controller.getStatus().phase).toBe("resting");
    port.emit("movestart", "user");
    expect(controller.getStatus().phase).toBe("moving");
    port.emit("moveend", "user", WHERE_IT_STOPS);
    vi.advanceTimersByTime(QUIET_MS - 1);
    expect(requests).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(requests).toHaveLength(1);
    expect(requests[0].cell).toEqual(cellOf(WHERE_IT_STOPS.lng, WHERE_IT_STOPS.lat));
    expect(requests[0].cell).not.toEqual(cellOf(MID_AIR.lng, MID_AIR.lat));
    expect(requests[0].cell).not.toEqual(cellOf(DESTINATION.lng, DESTINATION.lat));
    expect(controller.getStatus()).toMatchObject({ candidate: cellOf(WHERE_IT_STOPS.lng, WHERE_IT_STOPS.lat) });
  });

  it("asks for nothing when the person's hold is only the flight being cut, and they let go without moving the map", () => {
    const { controller, requests, port } = rig();
    port.emit("movestart", "program");
    port.emit("moveend", "program", MID_AIR);
    vi.advanceTimersByTime(60_000);
    expect(requests).toHaveLength(0);
    expect(controller.getStatus().candidate).toBeNull();
  });

  it("settles on where the person leaves the map even if the flight's end is heard after their movement began", () => {
    const { controller, requests, port } = rig();
    port.emit("movestart", "program");
    port.emit("movestart", "user");
    port.emit("moveend", "program", MID_AIR); // the cut of the flight, heard late: the code's, and no quiet is running
    expect(controller.getStatus().phase).toBe("moving");
    port.emit("moveend", "user", WHERE_IT_STOPS);
    vi.advanceTimersByTime(QUIET_MS);
    expect(requests).toHaveLength(1);
    expect(requests[0].cell).toEqual(cellOf(WHERE_IT_STOPS.lng, WHERE_IT_STOPS.lat));
  });
});

describe("refresh (WTH-359)", () => {
  it("asks again for the point on show while the map rests, and only then", () => {
    const { controller, requests } = rig();
    expect(controller.refresh()).toBe(false);
    controller.select(cellOf(TORINO.lng, TORINO.lat));
    expect(requests).toHaveLength(1);
    // in flight: nothing more
    expect(controller.refresh()).toBe(false);
    controller.resolve(requests[0].seq, { ok: true });
    expect(controller.refresh()).toBe(true);
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({ cell: requests[0].cell, reason: "refresh" });
  });

  it("never asks again while the map moves; a point that failed is asked for again, not the one before it", () => {
    const { controller, requests, port } = rig();
    controller.select(cellOf(TORINO.lng, TORINO.lat));
    controller.resolve(requests[0].seq, { ok: true });
    port.user(GENOVA, { end: false });
    expect(controller.refresh()).toBe(false);
    port.emit("moveend", "user", GENOVA);
    vi.advanceTimersByTime(QUIET_MS);
    controller.resolve(requests.at(-1)!.seq, { ok: false, reason: "upstream" });
    const asked = requests.length;
    expect(controller.refresh()).toBe(true);
    expect(requests).toHaveLength(asked + 1);
    expect(requests.at(-1)).toMatchObject({ cell: cellOf(GENOVA.lng, GENOVA.lat), reason: "refresh" });
  });

  it("a refresh that failed does not stop the next one", () => {
    const { controller, requests } = rig();
    controller.select(cellOf(TORINO.lng, TORINO.lat));
    controller.resolve(requests[0].seq, { ok: true });
    controller.refresh();
    controller.resolve(requests[1].seq, { ok: false, reason: "upstream" });
    expect(controller.refresh()).toBe(true);
    expect(requests[2]).toMatchObject({ cell: requests[0].cell, reason: "refresh" });
  });
});
