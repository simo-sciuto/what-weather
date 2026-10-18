import { POINT_TIMEOUT_MS } from "@/constants/atlas";
import type { AtlasPoint, Cell, FailureReason, PointResult } from "@/types/atlas";

type Options = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Extra query parameters for the request (the sample weather's `mock` and `at`, in tests) */
  extra?: () => Record<string, string>;
  /** Whether the browser says it is online, to tell "offline" from "upstream" */
  online?: () => boolean;
};

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const SKY_COLOURS = ["sky1", "sky2", "sky3", "glass", "glow", "sun", "cloud"] as const;
const AIR_FIELDS = ["depth", "waterWeight", "roadWeight", "buildingWeight", "terrainWeight", "saturation", "landLift", "waterDeepen"] as const;

function isSky(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const sky = v as Record<string, unknown>;
  const air = sky.air as Record<string, unknown> | undefined;
  // The three stops feed the map's inks, which read a hex colour: anything else is a failed request, not a broken map
  const stops = ["sky1", "sky2", "sky3"].every((k) => typeof sky[k] === "string" && /^#[0-9a-f]{6}$/i.test(sky[k] as string));
  return stops && SKY_COLOURS.every((k) => typeof sky[k] === "string") && !!air && AIR_FIELDS.every((k) => isNumber(air[k]));
}

/** A place is nothing, or an object whose names are text and whose distance is a number */
function isPlace(v: unknown): boolean {
  if (v === null) return true;
  if (!v || typeof v !== "object") return false;
  return Object.entries(v as Record<string, unknown>).every(([k, x]) => (k === "nearKm" ? isNumber(x) : typeof x === "string"));
}

/** The answer is checked, not trusted: a wrong shape is a failed request, never a half-drawn point */
export function isAtlasPoint(v: unknown): v is AtlasPoint {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  const cell = p.cell as Record<string, unknown> | undefined;
  return (
    !!cell &&
    isSky(p.sky) &&
    isPlace(p.place) &&
    isNumber(cell.lat) &&
    isNumber(cell.lon) &&
    typeof p.timezone === "string" &&
    typeof p.provider === "string" &&
    isNumber(p.time) &&
    isNumber(p.temp) &&
    typeof p.label === "string" &&
    typeof p.condition === "string" &&
    typeof p.night === "boolean"
  );
}

/**
 * Asks `/api/atlas/point` for a cell. `signal` is the controller's (aborted when a newer request takes over); a
 * timeout is the fetcher's own. Never throws: the result says why it failed, in the controller's words.
 */
export function createPointFetcher(options: Options = {}) {
  const run = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const timeoutMs = options.timeoutMs ?? POINT_TIMEOUT_MS;
  const online = options.online ?? (() => (typeof navigator === "undefined" ? true : navigator.onLine));

  return async function fetchPoint(cell: Cell, signal: AbortSignal): Promise<PointResult> {
    const fail = (reason: FailureReason): PointResult => ({ ok: false, reason });
    const query = new URLSearchParams({ lat: String(cell.lat), lon: String(cell.lon), ...options.extra?.() });
    try {
      const response = await run(`/api/atlas/point?${query}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) });
      if (!response.ok) return fail(response.status >= 500 ? "upstream" : "unknown");
      const body: unknown = await response.json();
      return isAtlasPoint(body) ? { ok: true, point: body } : fail("upstream");
    } catch (error) {
      if (signal.aborted) return fail("unknown");
      if (error instanceof DOMException && error.name === "TimeoutError") return fail("timeout");
      return fail(online() ? "upstream" : "offline");
    }
  };
}
