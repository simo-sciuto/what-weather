import { NOW_TICK_MS } from "@/constants/moment";

/**
 * The clock "Adesso" follows (ADR-019): an external store, read with `useSyncExternalStore`, that ticks once a
 * minute and only while somebody listens. Time and timers are injected, so it is tested with fake ones.
 */
export type Clock = {
  /** The current time, Unix seconds, read now */
  now: () => number;
  /** The time at the last tick (or at the first listener): stable between ticks, as a snapshot must be */
  getSnapshot: () => number;
  subscribe: (listener: () => void) => () => void;
};

export type ClockDeps = {
  /** Milliseconds since the epoch; defaults to `Date.now` */
  nowMs?: () => number;
  setInterval?: (handler: () => void, ms: number) => unknown;
  clearInterval?: (handle: unknown) => void;
  tickMs?: number;
};

export function createClock(deps: ClockDeps = {}): Clock {
  const nowMs = deps.nowMs ?? Date.now;
  const start = deps.setInterval ?? ((handler: () => void, ms: number) => setInterval(handler, ms));
  const stop = deps.clearInterval ?? ((handle: unknown) => clearInterval(handle as ReturnType<typeof setInterval>));
  const tickMs = deps.tickMs ?? NOW_TICK_MS;

  const now = () => Math.floor(nowMs() / 1000);
  const listeners = new Set<() => void>();
  let snapshot = now();
  let handle: unknown = null;

  const tick = () => {
    snapshot = now();
    for (const listener of [...listeners]) listener();
  };

  return {
    now,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (listeners.size === 0) {
        // The first listener finds a snapshot as old as the last time anybody listened: bring it up to date.
        snapshot = now();
        handle = start(tick, tickMs);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && handle !== null) {
          stop(handle);
          handle = null;
        }
      };
    },
  };
}
