import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTimeline } from "./frames";
import { createMockProvider } from "./mock";
import type { WeatherData } from "./types";

/*
 * WTH-002: which frames of the timeline are a provider's own point and which are an hour worked out between two.
 * `Frame.measured` says so, and only the timeline's labels use it. These tests pin when an hour is interpolated.
 */

const NOW = Date.parse("2026-10-04T10:00:00Z") / 1000;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW * 1000);
});
afterEach(() => vi.useRealTimers());

const hourlyData = () => createMockProvider("clear", "12:00").getByCoords(45.46, 9.19);
/** The same forecast as a three-hourly provider (OpenWeather's free tier) gives it: one point in three */
const threeHourly = (d: WeatherData): WeatherData => ({ ...d, hourly: d.hourly.filter((_, i) => i % 3 === 0) });

describe("which hours are a provider's own and which are interpolated (WTH-002)", () => {
  it("has every hour a provider's own when the provider is hourly, the reading of now included", async () => {
    const { frames } = buildTimeline(await hourlyData());
    expect(frames[0].isNow).toBe(true);
    expect(frames[0].measured).toBe(true);
    expect(frames.slice(1).every((f) => f.measured)).toBe(true);
  });

  it("interpolates two hours in three when the provider is three-hourly, and says so on exactly those", async () => {
    const data = threeHourly(await hourlyData());
    const { frames } = buildTimeline(data);
    const points = new Set(data.hourly.map((h) => h.time));
    for (const f of frames.slice(1)) expect(f.measured, `${f.timeLabel}`).toBe(points.has(f.time));
    expect(frames.filter((f) => !f.measured).length).toBeGreaterThan(frames.length / 2 - 2);
    expect(frames[0].measured).toBe(true);
  });

  it("works an interpolated hour out between its two neighbours, never beyond them, in the numbers the page shows", async () => {
    const { frames } = buildTimeline(threeHourly(await hourlyData()));
    frames.forEach((f, i) => {
      if (f.measured) return;
      const before = frames.slice(0, i).findLast((g) => g.measured)!;
      const after = frames.slice(i + 1).find((g) => g.measured)!;
      for (const key of ["temp", "feelsLike", "cloudCover", "windSpeed"] as const) {
        const [lo, hi] = [Math.min(before[key], after[key]), Math.max(before[key], after[key])];
        expect(f[key], `${f.timeLabel} ${key}`).toBeGreaterThanOrEqual(lo - 0.01);
        expect(f[key], `${f.timeLabel} ${key}`).toBeLessThanOrEqual(hi + 0.01);
      }
    });
  });

  it("marks a day's overview, which is no hour at all, as not measured", async () => {
    const timeline = buildTimeline(await hourlyData());
    for (const d of timeline.days) expect(d.overview.measured).toBe(false);
  });
});
