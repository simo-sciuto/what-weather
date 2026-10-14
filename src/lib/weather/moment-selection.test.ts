import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockProvider } from "@/lib/api/providers/mock";
import type { TimeSelection } from "@/types/time";
import type { Frame, Timeline } from "@/types/timeline";
import { buildTimeline } from "./frames";
import {
  DAY_OPENS_AT,
  NOW_SELECTION,
  indexForSelection,
  sameSelection,
  selectionForDay,
  selectionForIndex,
} from "./moment-selection";

/*
 * ADR-019, M1: the page's components keep speaking in indices (`useMoment().index`, `setIndex`, `isLive`). These tests
 * hold the translation to a selection to what the page did before: the legacy rules are written out here, as they were
 * in TimeProvider, and every frame of a real timeline is checked against them.
 */

const NOW = Date.parse("2026-10-04T10:00:00Z") / 1000;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW * 1000);
});
afterEach(() => vi.useRealTimers());

const timelineOf = async (): Promise<Timeline> => buildTimeline(await createMockProvider("clear", "12:00").getByCoords(45.07, 7.69));
const NEXT_HOURS = 24;

/** The frames on show, as TimeProvider builds them */
const framesOn = (timeline: Timeline, dayKey?: string): Frame[] => {
  const day = dayKey ? timeline.days.find((d) => d.key === dayKey) : undefined;
  if (!day) return timeline.frames.slice(0, NEXT_HOURS + 1);
  return day.hours.length ? day.hours.map((i) => timeline.frames[i]) : [day.overview];
};

/** What TimeProvider's `selectDay` set the index to before the selection existed */
const legacyDayIndex = (timeline: Timeline, key: string): number => {
  const target = timeline.days.find((d) => d.key === key)!;
  const midday = target.hours.findIndex((i) => timeline.frames[i].hour >= 12);
  return Math.max(0, midday);
};

describe("the next 24 hours, scrubbed", () => {
  it("round-trips every index, and only the first is live", async () => {
    const timeline = await timelineOf();
    const frames = framesOn(timeline);
    expect(frames).toHaveLength(NEXT_HOURS + 1);
    frames.forEach((_, i) => {
      const selection = selectionForIndex(frames, i, false);
      expect(indexForSelection(frames, selection), `index ${i}`).toBe(i);
      expect(selection.mode === "now", `live at ${i}`).toBe(i === 0);
    });
  });

  it("makes the first hour the live reading, one shared object, so setting it again changes nothing", async () => {
    const frames = framesOn(await timelineOf());
    expect(selectionForIndex(frames, 0, false)).toBe(NOW_SELECTION);
    expect(sameSelection(NOW_SELECTION, selectionForIndex(frames, 0, false))).toBe(true);
  });

  it("makes any other hour an absolute instant: that hour's own time", async () => {
    const frames = framesOn(await timelineOf());
    for (const i of [1, 5, 24]) expect(selectionForIndex(frames, i, false)).toEqual({ mode: "at", instant: frames[i].time });
  });

  it("holds an index outside the frames to the nearest end, as the page always read it", async () => {
    const frames = framesOn(await timelineOf());
    expect(selectionForIndex(frames, 99, false)).toEqual({ mode: "at", instant: frames[frames.length - 1].time });
    expect(selectionForIndex(frames, -3, false)).toBe(NOW_SELECTION);
  });
});

describe("a picked day", () => {
  it("opens where the page opened it, for every day of a real timeline", async () => {
    const timeline = await timelineOf();
    const picked = timeline.days.filter((d) => !d.isToday);
    expect(picked.length).toBeGreaterThan(0);
    for (const day of picked) {
      const frames = framesOn(timeline, day.key);
      const selection = selectionForDay(timeline, day);
      expect(selection.mode, day.key).toBe("at");
      expect(indexForSelection(frames, selection), day.key).toBe(legacyDayIndex(timeline, day.key));
    }
  });

  it("opens on the first hour from midday on, when the day has them", async () => {
    const timeline = await timelineOf();
    const day = timeline.days.find((d) => !d.isToday && d.hours.length > 0)!;
    const selection = selectionForDay(timeline, day) as Extract<TimeSelection, { mode: "at" }>;
    const frame = timeline.frames.find((f) => f.time === selection.instant)!;
    expect(frame.dayKey).toBe(day.key);
    expect(frame.hour).toBeGreaterThanOrEqual(DAY_OPENS_AT);
    // no hour of that day from midday on comes earlier
    const earlier = day.hours.map((i) => timeline.frames[i]).filter((f) => f.time < frame.time);
    expect(earlier.every((f) => f.hour < DAY_OPENS_AT)).toBe(true);
  });

  it("is never the live reading inside a day, whatever frame is picked in it", async () => {
    const timeline = await timelineOf();
    for (const day of timeline.days.filter((d) => !d.isToday && d.hours.length > 0)) {
      const frames = framesOn(timeline, day.key);
      frames.forEach((_, i) => {
        const selection = selectionForIndex(frames, i, true);
        expect(selection.mode, `${day.key} ${i}`).toBe("at");
        expect(indexForSelection(frames, selection), `${day.key} ${i}`).toBe(i);
      });
    }
  });

  it("shows a day with no hours by its summary, and opens on it", async () => {
    const timeline = await timelineOf();
    const day = {
      ...timeline.days.find((d) => !d.isToday)!,
      key: "2026-10-30",
      hours: [],
      overview: { ...timeline.days[0].overview, time: Date.parse("2026-10-30T10:00:00Z") / 1000 },
    };
    const synthetic = { ...timeline, days: [...timeline.days, day] };
    const frames = framesOn(synthetic, day.key);
    expect(frames).toEqual([day.overview]);
    const selection = selectionForDay(synthetic, day);
    expect(selection).toEqual({ mode: "at", instant: day.overview.time });
    expect(indexForSelection(frames, selection)).toBe(0);
    expect(selectionForIndex(frames, 0, true)).toEqual({ mode: "at", instant: day.overview.time });
  });

  it("is the live reading for today and for a day that is not on the timeline", async () => {
    const timeline = await timelineOf();
    expect(selectionForDay(timeline, timeline.days.find((d) => d.isToday))).toBe(NOW_SELECTION);
    expect(selectionForDay(timeline, undefined)).toBe(NOW_SELECTION);
  });
});

describe("a selection against frames that have moved on", () => {
  it("finds the frame with exactly the instant, or else the nearest, the earlier on a tie", async () => {
    const frames = framesOn(await timelineOf());
    expect(indexForSelection(frames, { mode: "at", instant: frames[4].time })).toBe(4);
    expect(indexForSelection(frames, { mode: "at", instant: frames[4].time + 10 })).toBe(4);
    expect(indexForSelection(frames, { mode: "at", instant: (frames[4].time + frames[5].time) / 2 })).toBe(4);
    expect(indexForSelection(frames, { mode: "at", instant: frames[0].time - 99_999 })).toBe(0);
    expect(indexForSelection(frames, { mode: "at", instant: frames[24].time + 99_999 })).toBe(24);
  });

  it("tells selections apart by their mode and instant", () => {
    expect(sameSelection({ mode: "now" }, { mode: "now" })).toBe(true);
    expect(sameSelection({ mode: "at", instant: 5 }, { mode: "at", instant: 5, chosenIn: "Asia/Tokyo" })).toBe(true);
    expect(sameSelection({ mode: "at", instant: 5 }, { mode: "at", instant: 6 })).toBe(false);
    expect(sameSelection({ mode: "now" }, { mode: "at", instant: 5 })).toBe(false);
    expect(sameSelection({ mode: "at", instant: 5 }, { mode: "now" })).toBe(false);
  });
});
