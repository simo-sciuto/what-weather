import type { Frame, Timeline } from "@/types/timeline";
import { WINDOW } from "./frames";

/**
 * Where a moment chosen on Explore sits in the place's timeline (WTH-236). The moment is named by its instant, Unix
 * seconds, which is stable: the timeline is cached per place, and the same instant is found in it again. Nothing
 * here asks the weather for anything: a moment the timeline does not hold is not available.
 */
export type MomentStart = {
  /** The day picked on Explore, or null for the next hours */
  day: string | null;
  /** The position in the span on show (the next hours, or the day's hours) */
  index: number;
  /** The current conditions: the first hour of the next hours, nothing picked */
  live: boolean;
};

/** The start of a moment in the timeline, or null when the timeline does not hold it (past, too far, or gone) */
export function momentStart(timeline: Timeline, time: number): MomentStart | null {
  const next = timeline.frames.slice(0, WINDOW + 1).findIndex((f) => f.time === time);
  if (next >= 0) return { day: null, index: next, live: next === 0 };
  for (const day of timeline.days) {
    if (day.hours.length) {
      const index = day.hours.findIndex((h) => timeline.frames[h].time === time);
      if (index >= 0) return { day: day.key, index, live: false };
    } else if (day.overview.time === time) {
      return { day: day.key, index: 0, live: false };
    }
  }
  return null;
}

/** The moment on show at a start: the frame the page draws, for its date and hour */
export function momentFrame(timeline: Timeline, start: MomentStart): Frame {
  if (start.day === null) return timeline.frames[start.index];
  const day = timeline.days.find((d) => d.key === start.day)!;
  return day.hours.length ? timeline.frames[day.hours[start.index]] : day.overview;
}
