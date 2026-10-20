import { POINT_MIN_INTERVAL_MS, QUIET_MS } from "@/constants/atlas";
import type { Bounds, Camera, CameraEvent, Lattice, WeatherField } from "@/types/atlas";
import { latticeFor, sameLattice, viewBounds } from "./lattice";

/**
 * Asks for the weather field of the view after a stop (WTH-272, ADR-026), the way the point is asked for: never while the
 * map moves, once the quiet has passed from the end of a movement, never closer than the least interval to the last
 * request, and not at all when the places the view needs are the ones already on show or on their way (a pan within the
 * same lattice, a zoom that keeps the step). A newer need drops the request it supersedes. A failure keeps the field that
 * is on show and is tried again at the next stop, never in a loop. All time is given, so it is tested with fake timers.
 */

export type FieldLoaderOptions = {
  /** The field for a view; throws or returns null when it cannot be had */
  fetchField: (bounds: Bounds, signal: AbortSignal) => Promise<WeatherField | null>;
  /** The size of the map on the screen, in pixels, to know what is in view */
  size: () => { width: number; height: number };
  /** A field arrived and is the one to show */
  onField: (field: WeatherField) => void;
  quietMs?: number;
  minIntervalMs?: number;
  timers?: { setTimeout: (handler: () => void, ms: number) => unknown; clearTimeout: (handle: unknown) => void };
  now?: () => number;
};

export type FieldLoader = {
  /** The camera as the port tells it: `movestart` cancels what waits, `moveend` starts the quiet */
  onCamera: (event: CameraEvent) => void;
  /** The view as it is now, with no movement to wait for (the first one) */
  start: (camera: Camera) => void;
  /** Asks for the view again even if it is the one on show (WTH-359) */
  refresh: (camera: Camera) => void;
  dispose: () => void;
};

export function createFieldLoader(options: FieldLoaderOptions): FieldLoader {
  const quietMs = options.quietMs ?? QUIET_MS;
  const minInterval = options.minIntervalMs ?? POINT_MIN_INTERVAL_MS;
  const now = options.now ?? Date.now;
  const setTimer = options.timers?.setTimeout ?? ((h: () => void, ms: number) => setTimeout(h, ms));
  const clearTimer = options.timers?.clearTimeout ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));

  let shown: Lattice | null = null;
  let inflight: { lattice: Lattice; abort: AbortController } | null = null;
  let lastStart = -Infinity;
  let timer: unknown = null;
  let disposed = false;

  const cancelTimer = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };

  function need(camera: Camera) {
    const bounds = viewBounds(camera, options.size());
    const lattice = latticeFor(bounds);
    if (sameLattice(lattice, shown) || sameLattice(lattice, inflight?.lattice ?? null)) return;
    const wait = Math.max(0, lastStart + minInterval - now());
    cancelTimer();
    const go = () => {
      timer = null;
      if (disposed) return;
      inflight?.abort.abort();
      const abort = new AbortController();
      const mine = { lattice, abort };
      inflight = mine;
      lastStart = now();
      // the request is made here and now (an async function runs to its first await), the answer is waited for
      void (async () => {
        try {
          const field = await options.fetchField(bounds, abort.signal);
          if (abort.signal.aborted || disposed || inflight !== mine) return;
          inflight = null;
          if (!field) return;
          shown = lattice;
          options.onField(field);
        } catch {
          if (inflight === mine) inflight = null;
        }
      })();
    };
    if (wait === 0) go();
    else timer = setTimer(go, wait);
  }

  return {
    onCamera(event) {
      if (disposed) return;
      if (event.type === "movestart") cancelTimer();
      else if (event.type === "moveend") {
        cancelTimer();
        timer = setTimer(() => {
          timer = null;
          need(event.camera);
        }, quietMs);
      }
    },
    start(camera) {
      if (!disposed) need(camera);
    },
    // The same view asked for again, its hours moved on (WTH-359): only with nothing in flight or waiting
    refresh(camera) {
      if (disposed || inflight || timer !== null) return;
      shown = null;
      need(camera);
    },
    dispose() {
      disposed = true;
      cancelTimer();
      inflight?.abort.abort();
      inflight = null;
    },
  };
}
