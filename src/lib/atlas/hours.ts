import { INSTANT_TOLERANCE_SECONDS } from "@/constants/moment";
import type { AtlasHour, AtlasPoint } from "@/types/atlas";
import type { TimeSelection, UnavailableReason } from "@/types/time";

/**
 * Which hour of a point answers the time bar's instant (ADR-019, WTH-343), the Atlas's own form of `resolveInstant`:
 * the nearest hour the provider gave within half an hour (the earlier on a tie), or why there is none. An unavailable
 * instant has no hour: the caller keeps the instant and says so, it never shows another moment's weather in its place.
 */
export type HourResolution =
  | { status: "ok"; hour: AtlasHour; index: number }
  | { status: "unavailable"; reason: Exclude<UnavailableReason, "daily-only"> };

export function hourAt(hours: readonly AtlasHour[], instant: number, toleranceSeconds: number = INSTANT_TOLERANCE_SECONDS): HourResolution {
  if (!Number.isFinite(instant)) return { status: "unavailable", reason: "invalid" };
  if (hours.length === 0) return { status: "unavailable", reason: "no-frames" };
  let lo = 0;
  let hi = hours.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (hours[mid].time < instant) lo = mid + 1;
    else hi = mid;
  }
  const index = lo === 0 ? 0 : lo === hours.length ? hours.length - 1 : instant - hours[lo - 1].time <= hours[lo].time - instant ? lo - 1 : lo;
  if (Math.abs(hours[index].time - instant) <= toleranceSeconds) return { status: "ok", hour: hours[index], index };
  if (instant < hours[0].time) return { status: "unavailable", reason: "before-start" };
  if (instant > hours[hours.length - 1].time) return { status: "unavailable", reason: "beyond-horizon" };
  return { status: "unavailable", reason: "gap" };
}

/** What the Atlas shows of a point at a selection: "Adesso" is the point's own reading, an instant its hour or why not */
export type PointView =
  | { status: "ok"; hour: AtlasHour; live: boolean }
  | { status: "unavailable"; reason: Exclude<UnavailableReason, "daily-only">; requested: number };

export function viewOf(point: AtlasPoint, selection: TimeSelection): PointView {
  if (selection.mode === "now") {
    const { time, temp, label, condition, night, sky } = point;
    return { status: "ok", hour: { time, temp, label, condition, night, sky }, live: true };
  }
  const found = hourAt(point.hours, selection.instant);
  return found.status === "ok" ? { status: "ok", hour: found.hour, live: false } : { status: "unavailable", reason: found.reason, requested: selection.instant };
}

/** The words for an instant with no hour here, at the place's clock */
export const UNAVAILABLE_WORDS: Record<Exclude<UnavailableReason, "daily-only">, string> = {
  "beyond-horizon": "Per quest'ora la previsione non arriva.",
  "before-start": "Quest'ora è già passata: qui la previsione comincia dopo.",
  gap: "Per quest'ora qui non c'è un'ora di previsione.",
  "no-frames": "Qui la previsione non ha ore.",
  invalid: "Quest'ora non si legge.",
};
