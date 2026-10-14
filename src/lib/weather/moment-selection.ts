import type { TimeSelection } from "@/types/time";
import type { DayTimeline, Frame, Timeline } from "@/types/timeline";
import { clamp } from "@/utils/math";

/**
 * The home page's moment, as a selection (ADR-019). The scrubber and the week speak in indices into the frames on
 * show, which is the contract the page's components have always had (`useMoment().index`, `setIndex`); these
 * functions translate between that and a `TimeSelection`, so the same frame is picked as before:
 *
 *  - the first hour of the next 24 is "Adesso": it follows the reading, whatever time it is;
 *  - any other hour is an absolute instant, the hour's own `Frame.time`;
 *  - a day's own view never holds "Adesso".
 */

/** The selection of the live reading; one object, so setting it again changes nothing */
export const NOW_SELECTION: TimeSelection = { mode: "now" };

/** Opening a day lands on its middle */
export const DAY_OPENS_AT = 12;

/** Two selections that stand for the same moment */
export function sameSelection(a: TimeSelection, b: TimeSelection): boolean {
  return a.mode === "now" ? b.mode === "now" : b.mode === "at" && a.instant === b.instant;
}

/** The selection that shows `frames[index]`, the frames on show being the next 24 hours or one day's */
export function selectionForIndex(frames: Frame[], index: number, inDayView: boolean): TimeSelection {
  const i = clamp(index, 0, frames.length - 1);
  if (!inDayView && i === 0) return NOW_SELECTION;
  return { mode: "at", instant: frames[i].time };
}

/**
 * The index, into the frames on show, of what a selection shows: "Adesso" is the first; an instant is the frame
 * with exactly that time, or else the nearest (the earlier on a tie) when the frames have moved on since it was set.
 *
 * This is the home's legacy adapter: it has no tolerance and never says "unavailable", which the home never needs
 * (a place remounts the provider, and the refresh waits for "Adesso"). Whatever shows an instant across places
 * answers it with `resolveSelection` (instant.ts) and handles an unavailable one: M6 replaces this there.
 */
export function indexForSelection(frames: Frame[], selection: TimeSelection): number {
  if (selection.mode === "now") return 0;
  let best = 0;
  let bestDistance = Infinity;
  frames.forEach((f, i) => {
    const distance = Math.abs(f.time - selection.instant);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}

/**
 * The selection a picked day opens on: its first hour from midday on (or its first hour, or its summary when it
 * has no hours). Today, and a day that is not on the timeline, is "Adesso" in the next 24 hours' view.
 */
export function selectionForDay(timeline: Pick<Timeline, "frames" | "days">, day: DayTimeline | undefined): TimeSelection {
  if (!day || day.isToday) return NOW_SELECTION;
  const midday = day.hours.find((i) => timeline.frames[i].hour >= DAY_OPENS_AT);
  const first = midday ?? day.hours[0];
  return { mode: "at", instant: first === undefined ? day.overview.time : timeline.frames[first].time };
}
