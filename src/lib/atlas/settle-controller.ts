import { QUIET_MS } from "@/constants/atlas";
import type {
  AtlasPhase,
  AtlasStatus,
  Camera,
  CameraEvent,
  Cell,
  CommitReason,
  CommitRequest,
  CommitResult,
} from "@/types/atlas";
import { cellOf, sameCell } from "./cell";

/**
 * When does the map's centre become a point whose weather is asked for (ADR-020)? Only after the map has stopped and
 * stayed still for the quiet; never while it moves. The controller is a state machine with no I/O of its own: it
 * hears the camera (`onCamera`), asks its owner for a point (`onCommit`) and is told how the request went (`resolve`).
 * It knows nothing of the weather, the router or React; time comes from timers it is given (the globals by default),
 * so it is tested with fake ones.
 *
 * It keeps three points apart: the `candidate` (where the map last settled, or a point picked on purpose), the
 * `loaded` point (whose weather is on show) and the `failed` one, with the `inflight` request in between. The status
 * changes only when one of them or the phase does, so a listener is not called for every frame of a movement: `move`
 * events are ignored here.
 *
 * Rules:
 *  - a movement by the person starts or restarts the moving phase and cancels a quiet that is running;
 *  - the quiet starts at the person's `moveend` (the map's inertia is already in it);
 *  - a move by the code never starts a quiet, but it cancels one that is running: the camera is no longer where the
 *    person left it, and a point picked on purpose goes through `select`;
 *  - when the quiet ends, the cell under the map's centre is the candidate: the same as the loaded one asks for
 *    nothing, the same as the one in flight asks for nothing, any other is requested;
 *  - every request has a sequence number and an `AbortSignal`: a newer request aborts the older one, and an answer to
 *    anything but the latest is `stale` and changes nothing;
 *  - a failure is kept, never retried alone: `retry` asks again, on purpose, in any phase (the person can go on
 *    exploring after an error and press "Riprova" while the map moves). A settle on the point that failed is the
 *    person's own new attempt, not a retry alone, and asks for it again;
 *  - a request made while the map moves or settles does not take the phase from them: the phase says what the
 *    person is doing, `inflight` says what is on its way;
 *  - an `onCommit` that throws is a failed request (`unknown`), never a request left without an answer.
 */

export type SettleControllerOptions = {
  /** Called when a point is asked for. Answer with `resolve(request.seq, ...)`. */
  onCommit: (request: CommitRequest) => void;
  quietMs?: number;
  timers?: {
    setTimeout: (handler: () => void, ms: number) => unknown;
    clearTimeout: (handle: unknown) => void;
  };
};

export type SettleController = {
  getStatus: () => AtlasStatus;
  /** Called only when the status changed, never per frame */
  subscribe: (listener: (status: AtlasStatus) => void) => () => void;
  onCamera: (event: CameraEvent) => void;
  /** The weather of `cell` is on show without the controller having asked for it (the first render, say) */
  markLoaded: (cell: Cell) => void;
  /** The answer to a request; `stale` when a newer request has taken over, and then nothing changes */
  resolve: (seq: number, result: CommitResult) => "applied" | "stale";
  /** Asks again for the point that failed; false when nothing has failed */
  retry: () => boolean;
  /**
   * Asks again for the point on show, so "Adesso" stays now on a page left open (WTH-359), or for the one that failed;
   * only while the map rests and nothing is in flight. False when there was nothing to ask for.
   */
  refresh: () => boolean;
  /** Asks for a point on purpose (a search, a saved place, "Esplora qui"): no quiet, no wait */
  select: (cell: Cell) => void;
  dispose: () => void;
};

type Inflight = { seq: number; cell: Cell; abort: AbortController };

export function createSettleController(options: SettleControllerOptions): SettleController {
  const quietMs = options.quietMs ?? QUIET_MS;
  const setTimer = options.timers?.setTimeout ?? ((handler: () => void, ms: number) => setTimeout(handler, ms));
  const clearTimer = options.timers?.clearTimeout ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  let phase: AtlasPhase = "resting";
  let candidate: Cell | null = null;
  let loaded: Cell | null = null;
  let failed: AtlasStatus["failed"] = null;
  let inflight: Inflight | null = null;
  let seq = 0;
  let disposed = false;
  let timer: unknown = null;
  /** The camera at the last move's end, whoever made it: what the quiet will look at */
  let resting: Camera | null = null;
  let status: AtlasStatus = { phase, candidate, loaded, inflight: null, failed };
  const listeners = new Set<(status: AtlasStatus) => void>();

  /** The phase when nothing is moving and no quiet runs */
  const stillPhase = (): AtlasPhase => (inflight ? "loading" : failed ? "failed" : "resting");

  /** The same cell, or both none: a value-equal cell does not make a new status */
  const sameOrNone = (a: Cell | null, b: Cell | null) => a === b || sameCell(a, b);

  function publish() {
    const next: AtlasStatus = { phase, candidate, loaded, inflight: inflight ? inflight.cell : null, failed };
    const same =
      next.phase === status.phase &&
      sameOrNone(next.candidate, status.candidate) &&
      sameOrNone(next.loaded, status.loaded) &&
      sameOrNone(next.inflight, status.inflight) &&
      (next.failed === status.failed ||
        (next.failed !== null &&
          status.failed !== null &&
          next.failed.reason === status.failed.reason &&
          sameCell(next.failed.cell, status.failed.cell)));
    if (same) return;
    status = next;
    for (const listener of [...listeners]) listener(status);
  }

  function cancelQuiet() {
    if (timer === null) return;
    clearTimer(timer);
    timer = null;
  }

  /** Whatever is on its way is of no use now: aborted, and its answer, when it comes, finds no request to answer */
  function supersede() {
    if (!inflight) return;
    inflight.abort.abort();
    inflight = null;
  }

  function commit(cell: Cell, reason: CommitReason) {
    supersede();
    seq++;
    const abort = new AbortController();
    inflight = { seq, cell, abort };
    candidate = cell;
    failed = null;
    // The phase says what the person is doing: a request made while the map moves or settles does not take it
    if (phase !== "moving" && phase !== "settling") phase = "loading";
    publish();
    const mine = seq;
    try {
      options.onCommit({ seq: mine, cell, reason, signal: abort.signal });
    } catch {
      // The owner could not even start the request: that is a failure, and the machine must not wait for an answer
      api.resolve(mine, { ok: false, reason: "unknown" });
    }
  }

  /** The point the map rests on is decided: ask for it, or not */
  function settle() {
    timer = null;
    // The quiet is over: the phase is whatever the request and the failure say, and `commit` may set it
    phase = "resting";
    const cell = resting ? cellOf(resting.lng, resting.lat) : null;
    if (!cell) {
      phase = stillPhase();
      publish();
      return;
    }
    failed = null;
    if (sameCell(cell, loaded)) {
      // Back on the point on show: whatever was on its way for another is of no use now
      supersede();
      candidate = cell;
      phase = "resting";
      publish();
      return;
    }
    if (inflight && sameCell(cell, inflight.cell)) {
      candidate = inflight.cell;
      phase = "loading";
      publish();
      return;
    }
    commit(cell, "settle");
  }

  const api: SettleController = {
    getStatus: () => status,

    subscribe(listener) {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    onCamera(event) {
      if (disposed || event.type === "move") return;
      if (event.type === "movestart") {
        const wasQuiet = timer !== null;
        cancelQuiet();
        if (event.origin === "user") {
          phase = "moving";
          publish();
        } else if (wasQuiet) {
          phase = stillPhase();
          publish();
        }
        return;
      }
      // moveend
      resting = event.camera;
      if (event.origin !== "user") {
        // A move by the code that was not seen starting: the camera is no longer where the person left it
        if (timer !== null) {
          cancelQuiet();
          phase = stillPhase();
          publish();
        }
        return;
      }
      cancelQuiet();
      phase = "settling";
      timer = setTimer(settle, quietMs);
      publish();
    },

    markLoaded(cell) {
      if (disposed) return;
      loaded = cell;
      if (failed && sameCell(failed.cell, cell)) failed = null;
      if (inflight && sameCell(inflight.cell, cell)) supersede();
      if (phase === "loading" || phase === "failed") phase = stillPhase();
      publish();
    },

    resolve(answered, result) {
      if (disposed || !inflight || inflight.seq !== answered) return "stale";
      const cell = inflight.cell;
      inflight = null;
      if (result.ok) {
        loaded = cell;
        failed = null;
      } else {
        failed = { cell, reason: result.reason };
      }
      if (phase === "loading") phase = stillPhase();
      publish();
      return "applied";
    },

    retry() {
      if (disposed || !failed) return false;
      commit(failed.cell, "retry");
      return true;
    },

    refresh() {
      if (disposed || inflight || (phase !== "resting" && phase !== "failed")) return false;
      // A point that failed is asked for again too: one lost answer must not stop the page from ever catching up
      const cell = failed?.cell ?? loaded;
      if (!cell) return false;
      commit(cell, "refresh");
      return true;
    },

    select(cell) {
      if (disposed) return;
      cancelQuiet();
      // A quiet that was running is cancelled: what the map rests on is no longer the point of the moment
      if (phase === "settling") phase = stillPhase();
      if (sameCell(cell, loaded)) {
        supersede();
        candidate = cell;
        failed = null;
        phase = "resting";
        publish();
        return;
      }
      if (inflight && sameCell(cell, inflight.cell)) {
        candidate = cell;
        phase = "loading";
        publish();
        return;
      }
      commit(cell, "select");
    },

    dispose() {
      disposed = true;
      cancelQuiet();
      if (inflight) inflight.abort.abort();
      inflight = null;
      listeners.clear();
    },
  };
  return api;
}
