import { INSTANT_TOLERANCE_SECONDS } from "@/constants/moment";
import type { MomentResolution, TimeSelection } from "@/types/time";
import type { Frame, Timeline } from "@/types/timeline";
import { formatTime, localDay } from "./formatters";

/**
 * Absolute time (ADR-019): which hour of a forecast answers an instant, and what to call it at the place.
 * Pure: no clock, no React, every input passed in.
 */

/** The selection of the live reading; one object, so setting it again changes nothing */
export const NOW_SELECTION: TimeSelection = { mode: "now" };

/** What a place's forecast offers: its hours and days, and the IANA zone its days and labels are counted in */
export type InstantSource = {
  timeline: Pick<Timeline, "frames" | "days">;
  timezone: string;
};

/**
 * The index of the frame nearest to `instant`; a tie goes to the earlier one. `frames` must be in ascending order of
 * time, as `buildTimeline` makes them.
 */
function nearestIndex(frames: Frame[], instant: number): number {
  let lo = 0;
  let hi = frames.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].time < instant) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return 0;
  if (lo === frames.length) return frames.length - 1;
  return instant - frames[lo - 1].time <= frames[lo].time - instant ? lo - 1 : lo;
}

/**
 * The hour of the forecast that answers `instant`, or why there is none. The answer comes from the frames the
 * provider really gave (never from a fixed length of forecast):
 *
 *  - an hour within `toleranceSeconds` of the instant answers it, the nearest one (the earlier on a tie);
 *  - a day the forecast covers only with a daily summary is `daily-only`: its `Frame.overview` is no hour and is
 *    never returned as one;
 *  - otherwise the instant is `before-start`, `beyond-horizon`, or in a `gap` between two distant hours.
 *
 * An unavailable instant has no frame: whoever asked keeps the instant and decides what to say, it is never quietly
 * answered with another moment. An instant that is not a finite number is `invalid`, never a crash.
 */
export function resolveInstant(
  { timeline, timezone }: InstantSource,
  instant: number,
  toleranceSeconds: number = INSTANT_TOLERANCE_SECONDS,
): MomentResolution {
  const { frames, days } = timeline;
  if (!Number.isFinite(instant)) return { status: "unavailable", requested: instant, reason: "invalid" };
  if (frames.length === 0) return { status: "unavailable", requested: instant, reason: "no-frames" };

  const frameIndex = nearestIndex(frames, instant);
  const frame = frames[frameIndex];
  // `Timeline.frames` holds hours only (`buildTimeline` keeps the daily summaries in `days`); one that strayed in is no hour
  if (frame.overview) return { status: "unavailable", requested: instant, reason: "daily-only" };
  const offsetSeconds = frame.time - instant;
  if (Math.abs(offsetSeconds) <= toleranceSeconds) {
    return { status: "ok", requested: instant, frame, frameIndex, offsetSeconds, measured: frame.measured };
  }

  const day = days.find((d) => d.key === localDay(instant, timezone));
  if (day && day.hours.length === 0) return { status: "unavailable", requested: instant, reason: "daily-only" };
  if (instant < frames[0].time) return { status: "unavailable", requested: instant, reason: "before-start" };
  if (instant > frames[frames.length - 1].time) return { status: "unavailable", requested: instant, reason: "beyond-horizon" };
  return { status: "unavailable", requested: instant, reason: "gap" };
}

/** The instant a selection stands for at the moment `nowSeconds`: "Adesso" is the clock, never a stored time */
export function instantOf(selection: TimeSelection, nowSeconds: number): number {
  return selection.mode === "now" ? nowSeconds : selection.instant;
}

/** What a selection shows at a place, at the moment `nowSeconds` */
export function resolveSelection(
  source: InstantSource,
  selection: TimeSelection,
  nowSeconds: number,
  toleranceSeconds?: number,
): MomentResolution {
  return resolveInstant(source, instantOf(selection, nowSeconds), toleranceSeconds);
}

/** How a resolution reads at the place: the local time and day of the answering hour, and of the instant asked for */
export type MomentLabels = {
  /** The answering hour's own local time, "18:00"; the requested instant's when there is none */
  time: string;
  /** The local calendar day of `time`, "YYYY-MM-DD" (its name and date are in `Timeline.dayLabels`) */
  day: string;
  /** The requested instant's local time */
  requestedTime: string;
  requestedDay: string;
  /** The answering hour is not exactly the instant asked for: show `time`, not `requestedTime`, as the reading's own */
  shifted: boolean;
};

/**
 * The labels of a resolution in the zone of the place it is shown at: the same instant reads as a different local
 * time at another place. Half-hour and 45-minute zones show their minutes ("21:30"), so a time is never rounded
 * to a whole hour it is not.
 */
export function momentLabels(resolution: MomentResolution, timezone: string): MomentLabels {
  const requestedTime = formatTime(resolution.requested, timezone);
  const requestedDay = localDay(resolution.requested, timezone);
  if (resolution.status === "unavailable") {
    return { time: requestedTime, day: requestedDay, requestedTime, requestedDay, shifted: false };
  }
  const at = resolution.frame.time;
  return {
    time: formatTime(at, timezone),
    day: localDay(at, timezone),
    requestedTime,
    requestedDay,
    shifted: resolution.offsetSeconds !== 0,
  };
}
