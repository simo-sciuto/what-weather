import { NOW_SELECTION } from "@/lib/weather/instant";
import type { TimeSelection } from "@/types/time";

/**
 * The Atlas's moment (WTH-343): "Adesso" or an absolute instant (ADR-019), held outside React so the parts that follow
 * it subscribe on their own. Changing it never moves the camera, the layer or the selection. Setting the same moment
 * again changes nothing and tells nobody.
 */
export type TimeStore = {
  get: () => TimeSelection;
  set: (selection: TimeSelection) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createTimeStore(initial: TimeSelection = NOW_SELECTION): TimeStore {
  let current = initial.mode === "now" ? NOW_SELECTION : initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(next) {
      const same = next.mode === current.mode && (next.mode === "now" || (current.mode === "at" && next.instant === current.instant));
      if (same) return;
      current = next.mode === "now" ? NOW_SELECTION : next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
