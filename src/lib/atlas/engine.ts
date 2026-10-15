import { POINT_MIN_INTERVAL_MS } from "@/constants/atlas";
import { createSettleController, type SettleController, type SettleControllerOptions } from "@/lib/atlas/settle-controller";
import type { AtlasPoint, AtlasStatus, Cell, PointResult } from "@/types/atlas";

export type AtlasSnapshot = { status: AtlasStatus; point: AtlasPoint | null };

export type AtlasEngineOptions = {
  fetchPoint: (cell: Cell, signal: AbortSignal) => Promise<PointResult>;
  /** A point's weather has arrived and is the one on show (the URL follows it) */
  onPoint?: (point: AtlasPoint) => void;
  quietMs?: number;
  minIntervalMs?: number;
  timers?: SettleControllerOptions["timers"];
  now?: () => number;
};

export type AtlasEngine = {
  controller: SettleController;
  /** The status and the point on show, one object that changes only when one of them does (for `useSyncExternalStore`) */
  getSnapshot: () => AtlasSnapshot;
  subscribe: (listener: () => void) => () => void;
  dispose: () => void;
};

/**
 * The commit pipeline (M4, ADR-022): the settle controller (M2) asks for a point after the quiet, this asks the server
 * for it, and the answer goes back to the controller, which drops it if a newer request has taken over. Three rules:
 * a request is never started less than `minIntervalMs` after the last one (a trailing one waits, and is dropped if
 * superseded in the meantime); nothing is asked for while the map moves, because the controller does not ask; and the
 * point on show changes only when its answer was applied, so the previous point stays on a failure or a stale answer.
 */
export function createAtlasEngine(options: AtlasEngineOptions): AtlasEngine {
  const minInterval = options.minIntervalMs ?? POINT_MIN_INTERVAL_MS;
  const now = options.now ?? Date.now;
  const setTimer = options.timers?.setTimeout ?? ((handler: () => void, ms: number) => setTimeout(handler, ms));
  const clearTimer = options.timers?.clearTimeout ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  let point: AtlasPoint | null = null;
  let lastStart = -Infinity;
  const waiting = new Set<unknown>();
  const waitingOff = new Set<() => void>();
  const listeners = new Set<() => void>();

  const controller = createSettleController({
    quietMs: options.quietMs,
    timers: options.timers,
    onCommit(request) {
      const start = () => {
        lastStart = now();
        void options.fetchPoint(request.cell, request.signal).then((result) => {
          // The point on show is set before the status is told, so nobody sees the new status with the old point
          const previous = point;
          if (result.ok && !request.signal.aborted) point = result.point;
          const applied = controller.resolve(request.seq, result.ok ? { ok: true } : { ok: false, reason: result.reason });
          if (applied !== "applied") point = previous;
          else if (result.ok) {
            try {
              options.onPoint?.(result.point);
            } catch (error) {
              console.error("atlas onPoint failed", error);
            }
          }
        });
      };
      // A request waits for the interval, and for the map to be still: one that was held while the person began another
      // movement goes out when that movement is over (or is dropped, if it ends on another point), never during it
      const attempt = () => {
        if (request.signal.aborted) return;
        const phase = controller.getStatus().phase;
        if (phase === "moving" || phase === "settling") {
          const off = controller.subscribe(() => {
            const next = controller.getStatus().phase;
            if (next === "moving" || next === "settling") return;
            release();
            attempt();
          });
          const release = () => {
            off();
            waitingOff.delete(release);
            request.signal.removeEventListener("abort", release);
          };
          waitingOff.add(release);
          request.signal.addEventListener("abort", release, { once: true });
          return;
        }
        const wait = Math.max(0, lastStart + minInterval - now());
        if (wait === 0) return start();
        const handle = setTimer(() => {
          waiting.delete(handle);
          attempt();
        }, wait);
        waiting.add(handle);
        request.signal.addEventListener(
          "abort",
          () => {
            clearTimer(handle);
            waiting.delete(handle);
          },
          { once: true },
        );
      };
      attempt();
    },
  });

  let snapshot: AtlasSnapshot = { status: controller.getStatus(), point };
  function refresh() {
    snapshot = { status: controller.getStatus(), point };
    for (const l of [...listeners]) l();
  }
  const unsubscribe = controller.subscribe(refresh);

  return {
    controller,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      unsubscribe();
      for (const h of waiting) clearTimer(h);
      waiting.clear();
      for (const off of [...waitingOff]) off();
      listeners.clear();
      controller.dispose();
    },
  };
}
