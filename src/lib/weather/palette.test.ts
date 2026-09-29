import { describe, expect, it } from "vitest";
import { skyPalette } from "./palette";
import type { WeatherState } from "./state";

const STATES: WeatherState[] = ["CLEAR_DAY", "CLEAR_NIGHT", "PARTLY_CLOUDY", "CLOUDY", "FOG", "RAIN", "HEAVY_RAIN", "STORM", "SNOW"];

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function luminance(c: number[]) {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: number[], b: number[]) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
/** Muted text is white at 86% over the sky (see --ink-muted). */
const muted = (bg: number[]) => bg.map((v) => v + (255 - v) * 0.86);

describe("skyPalette", () => {
  // Every moment of the day, every weather, any cloud cover.
  const cases = STATES.flatMap((state) =>
    [0, 50, 100].flatMap((cloudCover) =>
      Array.from({ length: 61 }, (_, i) => ({ state, cloudCover, light: -1 + i * 0.05 })),
    ),
  );

  it("keeps muted white text at WCAG AA on every part of the sky", () => {
    const failures = cases.flatMap(({ state, cloudCover, light }) => {
      const p = skyPalette({ state, cloudCover, light });
      return (
        [
          ["sky1", p.sky1, 4.8],
          ["sky2", p.sky2, 4.6],
          ["sky3", p.sky3, 4.5],
        ] as const
      )
        .filter(([, hex, target]) => contrast(muted(rgb(hex)), rgb(hex)) < target - 0.01)
        .map(([name, hex]) => `${state} cover ${cloudCover} light ${light.toFixed(2)} ${name} ${hex}`);
    });
    expect(failures).toEqual([]);
  });

  it("returns well-formed colours", () => {
    for (const { state, cloudCover, light } of cases.filter((_, i) => i % 7 === 0)) {
      const p = skyPalette({ state, cloudCover, light });
      for (const hex of [p.sky1, p.sky2, p.sky3, p.sun]) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
