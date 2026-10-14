import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INSTANT_TOLERANCE_SECONDS } from "@/constants/moment";
import { HOUR_SECONDS } from "@/constants/time";
import { createMockProvider } from "@/lib/api/providers/mock";
import type { Frame, DayTimeline } from "@/types/timeline";
import type { WeatherData } from "@/types/weather";
import { buildTimeline } from "./frames";
import { localDay, localHour } from "./formatters";
import { instantOf, momentLabels, resolveInstant, resolveSelection, type InstantSource } from "./instant";

/*
 * ADR-019, M1: which hour answers an absolute instant, at which place, and what it is called there.
 * Two kinds of fixture: a hand-made timeline, where every number is known (zones, clocks changing, odd offsets), and
 * the real `buildTimeline` over the sample provider (what the page really has).
 */

const at = (iso: string) => Date.parse(iso) / 1000;

/** A frame on `time`, its local hour and day counted in `timezone`, as the timeline counts them */
function frame(time: number, timezone: string, extra: Partial<Frame> = {}): Frame {
  return {
    time,
    isNow: false,
    measured: true,
    timeLabel: "",
    hour: Math.floor(localHour(time, timezone)),
    dayKey: localDay(time, timezone),
    ...extra,
  } as Frame;
}

/** Hourly frames from `start` for `count` hours, and a day entry per local day they fall on, plus `dailyOnly` days after */
function source(timezone: string, start: number, count: number, dailyOnly: string[] = []): InstantSource {
  const frames = Array.from({ length: count }, (_, i) => frame(start + i * HOUR_SECONDS, timezone));
  const keys = [...new Set(frames.map((f) => f.dayKey))];
  const days = [
    ...keys.map((key) => ({ key, hours: frames.flatMap((f, i) => (f.dayKey === key ? [i] : [])), overview: { overview: true } }) as unknown as DayTimeline),
    ...dailyOnly.map((key) => ({ key, hours: [], overview: frame(at(`${key}T12:00:00Z`), timezone, { overview: true }) }) as unknown as DayTimeline),
  ];
  return { timeline: { frames, days }, timezone };
}

describe("an instant is the same instant in every place, and reads as the place's own time", () => {
  const start = at("2026-10-14T08:00:00Z");
  const torino = source("Europe/Rome", start, 48);
  const tokyo = source("Asia/Tokyo", start, 48);

  it("answers the same instant with the same hour at Torino and at Tokyo, and says a different local time at each", () => {
    const instant = at("2026-10-14T16:00:00Z");
    const a = resolveInstant(torino, instant);
    const b = resolveInstant(tokyo, instant);
    expect(a.status).toBe("ok");
    expect(b.status).toBe("ok");
    if (a.status !== "ok" || b.status !== "ok") return;
    expect(a.requested).toBe(instant);
    expect(b.requested).toBe(instant);
    expect(a.frame.time).toBe(instant);
    expect(b.frame.time).toBe(instant);
    expect(momentLabels(a, torino.timezone)).toMatchObject({ time: "18:00", day: "2026-10-14" });
    // The same instant is already the next day in Tokyo
    expect(momentLabels(b, tokyo.timezone)).toMatchObject({ time: "01:00", day: "2026-10-15" });
  });

  it("keeps a selected instant as it is whatever the clock says, and whatever zone it was chosen in", () => {
    const instant = at("2026-10-14T16:00:00Z");
    const selection = { mode: "at", instant, chosenIn: "Europe/Rome" } as const;
    const early = resolveSelection(tokyo, selection, at("2026-10-14T08:10:00Z"));
    const late = resolveSelection(tokyo, selection, at("2026-10-15T01:00:00Z"));
    expect(early).toEqual(late);
    expect(instantOf(selection, 123)).toBe(instant);
    expect(instantOf({ mode: "at", instant }, 123)).toBe(instant);
  });
});

describe("half-hour and 45-minute zones", () => {
  it.each([
    ["Asia/Kolkata", "21:30"],
    ["Asia/Kathmandu", "21:45"],
  ])("reads %s as %s, never rounded to a whole hour", (zone, expected) => {
    const src = source(zone, at("2026-10-14T08:00:00Z"), 24);
    const result = resolveInstant(src, at("2026-10-14T16:00:00Z"));
    expect(momentLabels(result, zone).time).toBe(expected);
  });

  it("gives every instant inside the forecast an answering hour, though no local hour is whole", () => {
    const src = source("Asia/Kathmandu", at("2026-10-14T08:00:00Z"), 24);
    for (let minutes = 0; minutes <= 23 * 60; minutes += 7) {
      const result = resolveInstant(src, at("2026-10-14T08:00:00Z") + minutes * 60);
      expect(result.status, `+${minutes} min`).toBe("ok");
    }
  });

  it("takes the earlier hour on an exact tie, and says it is not the instant asked for", () => {
    const src = source("Asia/Kolkata", at("2026-10-14T08:00:00Z"), 24);
    const result = resolveInstant(src, at("2026-10-14T16:30:00Z"));
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.frame.time).toBe(at("2026-10-14T16:00:00Z"));
    expect(result.offsetSeconds).toBe(-1800);
    const labels = momentLabels(result, "Asia/Kolkata");
    expect(labels).toMatchObject({ time: "21:30", requestedTime: "22:00", shifted: true });
  });
});

describe("clocks that change", () => {
  const rome = "Europe/Rome";

  it("tells apart the two 02:00 of the night the clocks go back, by the instant and not by the label", () => {
    // 2026-10-25: at 01:00 UTC the clocks go from 03:00 summer time back to 02:00
    const src = source(rome, at("2026-10-24T22:00:00Z"), 8);
    const first = resolveInstant(src, at("2026-10-25T00:00:00Z"));
    const second = resolveInstant(src, at("2026-10-25T01:00:00Z"));
    if (first.status !== "ok" || second.status !== "ok") throw new Error("both hours exist");
    expect(first.frame.time).not.toBe(second.frame.time);
    expect(momentLabels(first, rome).time).toBe("02:00");
    expect(momentLabels(second, rome).time).toBe("02:00");
    expect(first.frame.hour).toBe(2);
    expect(second.frame.hour).toBe(2);
    expect(momentLabels(first, rome).day).toBe("2026-10-25");
    // and the hour after reads 03:00, one real hour later
    const third = resolveInstant(src, at("2026-10-25T02:00:00Z"));
    expect(momentLabels(third, rome).time).toBe("03:00");
  });

  it("skips the local hour that does not exist the night the clocks go forward", () => {
    // 2026-03-29: at 01:00 UTC the clocks go from 02:00 winter time to 03:00
    const src = source(rome, at("2026-03-28T22:00:00Z"), 8);
    const before = resolveInstant(src, at("2026-03-29T00:00:00Z"));
    const after = resolveInstant(src, at("2026-03-29T01:00:00Z"));
    expect(momentLabels(before, rome).time).toBe("01:00");
    expect(momentLabels(after, rome).time).toBe("03:00");
  });

  it("holds the same instant across a change of clocks at another place", () => {
    const instant = at("2026-10-25T01:00:00Z");
    const newYork = source("America/New_York", at("2026-10-24T22:00:00Z"), 8);
    const result = resolveInstant(newYork, instant);
    expect(result.status).toBe("ok");
    // New York is still on summer time on that date: 01:00 UTC is 21:00 the evening before
    expect(momentLabels(result, "America/New_York")).toMatchObject({ time: "21:00", day: "2026-10-24" });
  });
});

describe("the edges of the forecast, drawn from its real hours", () => {
  const start = at("2026-10-14T10:00:00Z");
  const src = source("Europe/Rome", start, 10, ["2026-10-20"]);
  const last = start + 9 * HOUR_SECONDS;

  it("answers up to the tolerance past the last hour and no further", () => {
    const limit = resolveInstant(src, last + INSTANT_TOLERANCE_SECONDS);
    expect(limit.status).toBe("ok");
    const past = resolveInstant(src, last + INSTANT_TOLERANCE_SECONDS + 1);
    expect(past).toEqual({ status: "unavailable", requested: last + INSTANT_TOLERANCE_SECONDS + 1, reason: "beyond-horizon" });
  });

  it("says before-start for an instant earlier than the first hour by more than the tolerance", () => {
    expect(resolveInstant(src, start - INSTANT_TOLERANCE_SECONDS).status).toBe("ok");
    expect(resolveInstant(src, start - INSTANT_TOLERANCE_SECONDS - 1)).toMatchObject({ status: "unavailable", reason: "before-start" });
  });

  it("takes the length of the forecast from the frames, not from a constant", () => {
    const short = source("Europe/Rome", start, 3);
    const long = source("Europe/Rome", start, 40);
    const probe = start + 20 * HOUR_SECONDS;
    expect(resolveInstant(short, probe).status).toBe("unavailable");
    expect(resolveInstant(long, probe).status).toBe("ok");
  });

  it("reports a gap between hours that are further apart than the tolerance", () => {
    const sparse: InstantSource = {
      timezone: "Europe/Rome",
      timeline: { frames: [frame(start, "Europe/Rome"), frame(start + 3 * HOUR_SECONDS, "Europe/Rome")], days: src.timeline.days },
    };
    expect(resolveInstant(sparse, start + INSTANT_TOLERANCE_SECONDS).status).toBe("ok");
    expect(resolveInstant(sparse, start + INSTANT_TOLERANCE_SECONDS + 1)).toMatchObject({ status: "unavailable", reason: "gap" });
    expect(resolveInstant(sparse, start + 3 * HOUR_SECONDS - INSTANT_TOLERANCE_SECONDS - 1)).toMatchObject({ status: "unavailable", reason: "gap" });
    expect(resolveInstant(sparse, start + 3 * HOUR_SECONDS - INSTANT_TOLERANCE_SECONDS).status).toBe("ok");
  });

  it("says invalid, and does not throw, for an instant that is not a finite number", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const result = resolveInstant(src, bad);
      expect(result.status).toBe("unavailable");
      if (result.status === "unavailable") expect(result.reason).toBe("invalid");
      expect(() => momentLabels(result, "Europe/Rome")).toThrow(RangeError);
    }
  });

  it("says no-frames for a timeline without hours", () => {
    expect(resolveInstant({ timezone: "UTC", timeline: { frames: [], days: [] } }, start)).toMatchObject({ status: "unavailable", reason: "no-frames" });
  });
});

describe("a day known only by its summary is no hour", () => {
  const start = at("2026-10-14T10:00:00Z");
  const src = source("Europe/Rome", start, 10, ["2026-10-20"]);

  it("answers an instant on such a day with daily-only, and no frame at all", () => {
    const result = resolveInstant(src, at("2026-10-20T12:00:00Z"));
    expect(result).toEqual({ status: "unavailable", requested: at("2026-10-20T12:00:00Z"), reason: "daily-only" });
    expect("frame" in result).toBe(false);
  });

  it("never returns an overview frame as an hour, even one that sits among the hours", () => {
    const stray = frame(start + 4 * HOUR_SECONDS, "Europe/Rome", { overview: true });
    const withStray: InstantSource = { ...src, timeline: { ...src.timeline, frames: src.timeline.frames.map((f, i) => (i === 4 ? stray : f)) } };
    // The stray overview is not an answer: the instant on it is daily-only, never that frame as an hour
    expect(resolveInstant(withStray, start + 4 * HOUR_SECONDS)).toMatchObject({ status: "unavailable", reason: "daily-only" });
    for (let h = -30; h < 24 * 8; h += 5) {
      const r = resolveInstant(withStray, start + h * HOUR_SECONDS);
      if (r.status === "ok") expect(r.frame.overview).toBeUndefined();
    }
  });

  it("keeps the instant it was asked for, so the caller can say it and offer another moment", () => {
    const instant = at("2026-10-20T12:00:00Z");
    const result = resolveInstant(src, instant);
    expect(result.requested).toBe(instant);
    expect(momentLabels(result, "Europe/Rome")).toMatchObject({ time: "14:00", day: "2026-10-20", shifted: false });
  });
});

describe('"Adesso" follows the clock', () => {
  // The first frame is the provider's reading, 10 minutes before the hour; the rest sit on whole hours
  const first = at("2026-10-14T09:50:00Z");
  const frames = [frame(first, "Europe/Rome", { isNow: true }), ...Array.from({ length: 12 }, (_, i) => frame(at("2026-10-14T10:00:00Z") + i * HOUR_SECONDS, "Europe/Rome"))];
  const src: InstantSource = { timezone: "Europe/Rome", timeline: { frames, days: [] } };
  const now = { mode: "now" } as const;

  it("is the reading when the clock is at the reading", () => {
    const result = resolveSelection(src, now, first);
    expect(result).toMatchObject({ status: "ok", frameIndex: 0 });
  });

  it("moves on to the nearest hour as time passes, without anything being set", () => {
    const frameIndexAt = (iso: string) => {
      const r = resolveSelection(src, now, at(iso));
      return r.status === "ok" ? r.frameIndex : r.reason;
    };
    expect(frameIndexAt("2026-10-14T09:55:00Z")).toBe(0);
    expect(frameIndexAt("2026-10-14T10:20:00Z")).toBe(1); // the 10:00 hour is nearer than the 09:50 reading
    expect(frameIndexAt("2026-10-14T10:31:00Z")).toBe(2);
    expect(frameIndexAt("2026-10-14T13:00:00Z")).toBe(4);
  });

  it("is unavailable, not the reading, when the clock has run past the forecast or before it", () => {
    expect(resolveSelection(src, now, at("2026-10-15T08:00:00Z"))).toMatchObject({ status: "unavailable", reason: "beyond-horizon" });
    expect(resolveSelection(src, now, at("2026-10-14T09:00:00Z"))).toMatchObject({ status: "unavailable", reason: "before-start" });
  });

  it("is never a time frozen when the page opened: the same selection answers differently at a later clock", () => {
    const early = resolveSelection(src, now, at("2026-10-14T10:00:00Z"));
    const late = resolveSelection(src, now, at("2026-10-14T12:00:00Z"));
    expect(early).not.toEqual(late);
  });
});

/** The sample provider's weather, as the page builds it, with the clock held still */
describe("on the timeline the page really has", () => {
  const NOW = at("2026-10-04T10:00:00Z");
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW * 1000);
  });
  afterEach(() => vi.useRealTimers());

  const sample = (when = "12:00"): Promise<WeatherData> => createMockProvider("clear", when).getByCoords(45.07, 7.69);
  const threeHourly = (d: WeatherData): WeatherData => ({ ...d, hourly: d.hourly.filter((_, i) => i % 3 === 0) });

  it("builds frames in ascending order, which the nearest-hour search relies on", async () => {
    const { frames } = buildTimeline(await sample());
    frames.forEach((f, i) => i > 0 && expect(f.time).toBeGreaterThan(frames[i - 1].time));
  });

  it("starts from a reading off the exact hour and answers around it", async () => {
    const data = await sample("12:47");
    const timeline = buildTimeline(data);
    const src = { timeline, timezone: data.timezone };
    const reading = timeline.frames[0].time;
    expect(reading % HOUR_SECONDS).not.toBe(0);
    expect(resolveInstant(src, reading + 180)).toMatchObject({ status: "ok", frameIndex: 0 });
    expect(resolveInstant(src, reading + 8 * 60)).toMatchObject({ status: "ok", frameIndex: 1 });
    expect(resolveInstant(src, reading - 20 * 60)).toMatchObject({ status: "ok", frameIndex: 0 });
    expect(resolveInstant(src, reading - 31 * 60)).toMatchObject({ status: "unavailable", reason: "before-start" });
  });

  it("answers a selected instant from a provider that gives one point in three, and says which hours are worked out", async () => {
    const data = threeHourly(await sample());
    const timeline = buildTimeline(data);
    const src = { timeline, timezone: data.timezone };
    const points = new Set(data.hourly.map((h) => h.time));
    let own = 0;
    let worked = 0;
    for (const f of timeline.frames.slice(1)) {
      const r = resolveInstant(src, f.time);
      expect(r.status).toBe("ok");
      if (r.status !== "ok") continue;
      expect(r.frame.time).toBe(f.time);
      expect(r.measured, `${f.timeLabel}`).toBe(points.has(f.time));
      if (r.measured) own++;
      else worked++;
    }
    expect(own).toBeGreaterThan(0);
    expect(worked).toBeGreaterThan(own);
  });

  it("follows the sample provider's own clock (its `at`): \"Adesso\" is the reading, and an instant is the hour it names", async () => {
    for (const when of ["00:10", "06:45", "12:00", "23:30"]) {
      const data = await sample(when);
      const timeline = buildTimeline(data);
      const src = { timeline, timezone: data.timezone };
      const result = resolveSelection(src, { mode: "now" }, data.current.time);
      expect(result, when).toMatchObject({ status: "ok", frameIndex: 0 });
      expect(timeline.frames[0].time).toBe(data.current.time);
      const later = resolveSelection(src, { mode: "at", instant: timeline.frames[3].time }, data.current.time);
      expect(later, when).toMatchObject({ status: "ok", frameIndex: 3 });
    }
  });

  it("reaches its hourly horizon and no further, and does not mistake a day of summaries for hours", async () => {
    const data = await sample();
    const timeline = buildTimeline(data);
    const src = { timeline, timezone: data.timezone };
    const last = timeline.frames[timeline.frames.length - 1].time;
    expect(resolveInstant(src, last).status).toBe("ok");
    expect(resolveInstant(src, last + INSTANT_TOLERANCE_SECONDS).status).toBe("ok");
    const past = resolveInstant(src, last + 6 * HOUR_SECONDS);
    expect(past.status).toBe("unavailable");
    expect(timeline.days.length).toBeGreaterThan(0);
    for (const day of timeline.days.filter((d) => d.hours.length === 0)) {
      const noon = day.overview.time;
      const r = resolveInstant(src, noon);
      expect(r, day.key).toMatchObject({ status: "unavailable", reason: "daily-only" });
    }
    // every overview of the real timeline is flagged as the synthetic stand-in it is
    for (const d of timeline.days) expect(d.overview.overview).toBe(true);
  });

  it("moves a real timeline to another zone without moving the instant", async () => {
    const data = await sample();
    const instant = data.current.time + 6 * HOUR_SECONDS;
    const here = { timeline: buildTimeline(data), timezone: data.timezone };
    const tokyoData = { ...data, timezone: "Asia/Tokyo" };
    const there = { timeline: buildTimeline(tokyoData), timezone: "Asia/Tokyo" };
    const a = resolveInstant(here, instant);
    const b = resolveInstant(there, instant);
    if (a.status !== "ok" || b.status !== "ok") throw new Error("both resolve");
    expect(a.frame.time).toBe(b.frame.time);
    expect(momentLabels(a, here.timezone).time).not.toBe(momentLabels(b, there.timezone).time);
    // Tokyo is 7 hours ahead of Rome in October, and the frame's own label is the one the timeline made there
    expect(b.frame.timeLabel).toBe(momentLabels(b, "Asia/Tokyo").time);
  });
});
