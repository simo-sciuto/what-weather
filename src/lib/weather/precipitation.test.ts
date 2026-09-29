import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DEFAULT_PLACE } from "./constants";
import { createMockProvider } from "./mock";
import { precipOutlook } from "./precipitation";
import type { QuarterPoint, WeatherData } from "./types";

/**
 * The rain card from 15-minute amounts (Open-Meteo gives those, but its
 * chance comes by the hour): the bars must follow the amounts, and the card
 * must say how much, how hard and until when.
 */

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-28T10:00:00Z"));
});
afterAll(() => {
  vi.useRealTimers();
});

async function withQuarters(rates: number[], chance = 0.8): Promise<WeatherData> {
  const d = await createMockProvider("clear", "09:00").getByCoords(DEFAULT_PLACE.lat, DEFAULT_PLACE.lon);
  const quarters: QuarterPoint[] = rates.map((mm, i) => ({
    time: d.current.time + i * 900,
    condition: mm > 0 ? "rain" : "clear",
    precipProbability: chance,
    precipitation: mm,
  }));
  return { ...d, minutely: null, quarterHourly: quarters };
}

describe("rain card from 15-minute amounts", () => {
  it("shows intensity, the peak and when it ends", async () => {
    // Dry for an hour, then light rain building to heavy, easing, dry again
    const d = await withQuarters([0, 0, 0, 0, 1, 2, 4, 9, 9, 3, 1, 0, 0, 0, 0, 0]);
    const o = precipOutlook(d);
    expect(o?.measure).toBe("intensity");
    expect(o?.headline).toMatch(/^Pioggia debole dalle \d{2}:\d{2}, forte verso le \d{2}:\d{2}, fino alle \d{2}:\d{2} circa$/);
    // 29 mm/h over quarter hours = 7.25 mm
    expect(o?.facts?.map((f) => f.value)).toEqual([
      "7,3 mm",
      expect.stringMatching(/^9,0 mm\/h alle \d{2}:\d{2}$/),
      "fino al 80%",
    ]);
    // Bars follow the amounts, not the (flat) chance
    const heights = o!.bars.map((b) => b.value);
    expect(Math.max(...heights)).toBe(heights[7]);
    expect(heights[0]).toBe(0);
    // Axis labels only on whole hours
    expect(o!.ticks.every((t) => t.label.endsWith(":00"))).toBe(true);
  });

  it("falls back to the chance when no amounts are given", async () => {
    const d = await withQuarters(Array(16).fill(0));
    d.quarterHourly = d.quarterHourly!.map((q, i) => ({ ...q, condition: i >= 4 ? "rain" : "clear" }));
    const o = precipOutlook(d);
    expect(o?.measure).toBe("probability");
    expect(o?.facts).toBeUndefined();
  });
});
