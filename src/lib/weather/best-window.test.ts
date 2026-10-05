import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bestWindow, outdoorScore, windowLabel, type OutdoorHour } from "./best-window";
import { DEFAULT_PLACE } from "./constants";
import { buildTimeline } from "./frames";
import { createMockProvider, type MockScenario } from "@/lib/api/providers/mock";

/**
 * The best hours to be outside: which hours the score prefers, where the
 * window starts and stops, and how it is said.
 */

const TZ = "Europe/Rome";
/** 2026-09-28 00:00 in Rome (UTC+2) */
const MIDNIGHT = Date.UTC(2026, 8, 27, 22) / 1000;
const at = (hour: number) => MIDNIGHT + hour * 3600;

/** One hour of a mild, dry, calm day; each test changes what it is about. */
const hour = (h: number, over: Partial<OutdoorHour> = {}): OutdoorHour => ({
  time: at(h),
  feelsLike: 20,
  condition: "clear",
  precipProbability: 0,
  windSpeed: 5,
  night: h < 7 || h > 19,
  ...over,
});
/** A whole day, hour by hour, with a feels-like that peaks at 15. */
const day = (peak: number, over: (h: number) => Partial<OutdoorHour> = () => ({})) =>
  Array.from({ length: 24 }, (_, h) => hour(h, { feelsLike: peak - Math.abs(h - 15), ...over(h) }));

const hoursOf = (w: { from: number; to: number } | null) => w && [(w.from - MIDNIGHT) / 3600, (w.to - MIDNIGHT) / 3600];

describe("the score of an hour", () => {
  it("gives nothing to the dark, to storms and to likely rain", () => {
    expect(outdoorScore(hour(23))).toBe(0);
    expect(outdoorScore(hour(12, { condition: "thunderstorm", precipProbability: 0.2 }))).toBe(0);
    expect(outdoorScore(hour(12, { condition: "rain", precipProbability: 0.6 }))).toBe(0);
  });

  it("prefers mild to cold or hot, dry to uncertain, calm to windy, low UV to high", () => {
    const mild = outdoorScore(hour(12));
    expect(mild).toBeGreaterThan(outdoorScore(hour(12, { feelsLike: 6 })));
    expect(mild).toBeGreaterThan(outdoorScore(hour(12, { feelsLike: 33 })));
    expect(mild).toBeGreaterThan(outdoorScore(hour(12, { precipProbability: 0.3 })));
    expect(mild).toBeGreaterThan(outdoorScore(hour(12, { windSpeed: 45 })));
    expect(mild).toBeGreaterThan(outdoorScore(hour(12, { uvIndex: 9 })));
  });

  it("never rules an hour out for its temperature alone", () => {
    expect(outdoorScore(hour(12, { feelsLike: -12 }))).toBeGreaterThan(0.35);
    expect(outdoorScore(hour(12, { feelsLike: 41 }))).toBeGreaterThan(0.35);
  });
});

describe("the window", () => {
  it("is the warm middle of a cool day", () => {
    expect(hoursOf(bestWindow(day(14)))).toEqual([14, 16]);
  });

  it("is the cool ends of a hot day, the earlier one first", () => {
    expect(hoursOf(bestWindow(day(36)))).toEqual([7, 8]);
  });

  it("stops before the rain", () => {
    const rainFrom16 = day(22, (h) => (h >= 16 ? { condition: "rain", precipProbability: 0.8 } : {}));
    expect(hoursOf(bestWindow(rainFrom16))?.[1]).toBe(15);
  });

  it("is absent when it rains all day", () => {
    expect(bestWindow(day(22, () => ({ condition: "rain", precipProbability: 0.9 })))).toBeNull();
  });

  it("takes what is good soon over what is a little better tomorrow", () => {
    const today = [17, 18, 19].map((h) => hour(h, { feelsLike: 18 }));
    const night = [20, 21, 22, 23].map((h) => hour(h));
    const tomorrow = [24 + 12, 24 + 13, 24 + 14].map((h) => hour(h, { night: false, feelsLike: 22 }));
    expect(hoursOf(bestWindow([...today, ...night, ...tomorrow]))).toEqual([17, 19]);
  });
});

describe("the window in words", () => {
  it.each<[string, number, number, number | undefined]>([
    ["dalle 14 alle 18", 14, 18, at(9.5)],
    ["da mezzogiorno alle 16", 12, 16, at(9.5)],
    ["dalle 23 all’una", 23, 25, undefined],
    ["verso le 15", 15, 15, at(9.5)],
    ["adesso, fino alle 18", 9.5, 18, at(9.5)],
    ["adesso", 18.5, 18.5, at(18.5)],
    ["domani dalle 10 alle 16", 34, 40, at(21)],
    ["dalle 10 alle 16", 34, 40, undefined],
  ])("%s", (expected, from, to, now) => {
    expect(windowLabel({ from: at(from), to: at(to) }, TZ, now)).toBe(expected);
  });
});

describe("on the timeline", () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-28T10:00:00Z"));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  const timeline = async (scenario: MockScenario, time: string) =>
    buildTimeline(await createMockProvider(scenario, time).getByCoords(DEFAULT_PLACE.lat, DEFAULT_PLACE.lon));

  it.each<[MockScenario, string, string | null]>([
    ["partly-cloudy", "08:30", "adesso, fino alle 19"],
    ["rain-soon", "08:30", "da mezzogiorno alle 19"],
    ["clear", "22:30", "domani dalle 8 alle 11"],
    ["heavy-rain", "13:00", null],
    ["storm", "08:30", null],
    ["snow", "13:00", null],
  ])("%s at %s", async (scenario, time, expected) => {
    expect((await timeline(scenario, time)).best?.label ?? null).toBe(expected);
  });

  it("names a day's own best hours, but none for a day the forecast only partly covers", async () => {
    // The sample forecast runs 48 hours: tomorrow whole, the day after only its first hours.
    const { days } = await timeline("clear", "08:30");
    expect(days[1].best?.label).toBe("dalle 8 alle 11");
    expect(days[2].hours.length).toBeGreaterThan(0);
    expect(days[2].best).toBeNull();
  });
});
