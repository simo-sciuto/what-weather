/**
 * How the viewer has tuned the map's colours: their hue turned round the
 * colour wheel, how vivid they are, and how strongly the lines stand against
 * the sky. Kept in localStorage like the saved places (see saved-places.ts)
 * and exposed the same way, as an external store; every access is guarded.
 */

export interface MapTuning {
  /** Degrees round the wheel from the page's own colours (opposite the sky), 0 to 359 */
  hue: number;
  /** 0 (white lines) to 100 (as vivid as they get); 50 is the page's own pastel */
  vivid: number;
  /** 0 (barely there) to 100 (as strong as the sky allows); 50 is the page's own */
  contrast: number;
}

export const MAP_TUNING: MapTuning = { hue: 0, vivid: 50, contrast: 50 };

export const isUntuned = (t: MapTuning) =>
  t.hue === MAP_TUNING.hue && t.vivid === MAP_TUNING.vivid && t.contrast === MAP_TUNING.contrast;

const KEY = "weather:map-hue";

const listeners = new Set<() => void>();

export function subscribeMapTuning(onChange: () => void) {
  listeners.add(onChange);
  // Other tabs tuning it.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The raw stored string: a stable snapshot that only changes when the tuning does. */
export function mapTuningSnapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

const within = (v: unknown, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v))) : fallback;

/** Anything missing or senseless falls back to the page's own; a bare number is a hue (what was stored at first). */
export function parseMapTuning(raw: string): MapTuning {
  try {
    const stored: unknown = raw ? JSON.parse(raw) : null;
    const t = (typeof stored === "number" ? { hue: stored } : (stored ?? {})) as Partial<Record<keyof MapTuning, unknown>>;
    return {
      hue: within(t.hue, 359, MAP_TUNING.hue),
      vivid: within(t.vivid, 100, MAP_TUNING.vivid),
      contrast: within(t.contrast, 100, MAP_TUNING.contrast),
    };
  } catch {
    return MAP_TUNING;
  }
}

export function setMapTuning(tuning: MapTuning) {
  try {
    if (isUntuned(tuning)) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(tuning));
  } catch {
    // Storage unavailable (private mode, blocked): nothing is remembered, and nothing changes.
  }
  listeners.forEach((l) => l());
}
