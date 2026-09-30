import { describe, expect, it } from "vitest";
import { changeSinceYesterday, yesterdayWords } from "./yesterday";

/** Today against yesterday at the same hour: the change, and how it is said. */

const START = 1_790_000_000 - (1_790_000_000 % 3600);
/** Three days of hours: yesterday a flat 18°, then 1° more each day. */
const series = (gap?: number) => ({
  time: Array.from({ length: 72 }, (_, i) => START + i * 3600),
  temperature_2m: Array.from({ length: 72 }, (_, i) => (i === gap ? null : 18 + Math.floor(i / 24))),
});

describe("the change since yesterday", () => {
  it("compares the same time a day apart, between the hours around it", () => {
    expect(changeSinceYesterday(series(), START + 30.5 * 3600)).toBe(1);
    // One warm hour today, read half an hour past it: half of its 4° over a flat yesterday, plus the day's 1°
    const warm = series();
    warm.temperature_2m[30] = 23;
    expect(changeSinceYesterday(warm, START + 30.5 * 3600)).toBeCloseTo(3);
  });

  it("is unknown where the series doesn't reach, or has a gap", () => {
    expect(changeSinceYesterday(series(), START + 12 * 3600)).toBeNull();
    expect(changeSinceYesterday(series(), START + 80 * 3600)).toBeNull();
    expect(changeSinceYesterday(series(6), START + 30.5 * 3600)).toBeNull();
  });
});

describe("the change in words", () => {
  it.each<[number, string]>([
    [2.4, "2° in più di ieri"],
    [-3.2, "3° in meno di ieri"],
    [0.4, "Come ieri"],
    [-0.4, "Come ieri"],
    [-1, "1° in meno di ieri"],
  ])("%s", (change, expected) => {
    expect(yesterdayWords(change)).toBe(expected);
  });
});
