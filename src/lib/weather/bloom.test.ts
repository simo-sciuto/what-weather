import { describe, expect, it } from "vitest";
import { skyPalette } from "./palette";
import { bloomRadius, bloomStops, parseGlow } from "./bloom";

describe("the sun's bloom (WTH-179)", () => {
  const stops = bloomStops();

  it("falls from the centre to nothing at the rim, never rising", () => {
    expect(stops[0].offset).toBe(0);
    expect(stops.at(-1)!.offset).toBe(1);
    expect(stops.at(-1)!.share).toBeCloseTo(0, 10);
    stops.slice(1).forEach((s, i) => expect(s.share).toBeLessThanOrEqual(stops[i].share));
  });

  it("is a bloom, not a lamp: the centre gives less than the glow's whole alpha", () => {
    expect(stops[0].share).toBeLessThan(0.85);
    expect(stops[0].share).toBeGreaterThan(0.5);
  });

  it("has no hot spot and no edge: the first steps are nearly flat and the last nearly vanish", () => {
    // Slope at the centre is zero (Gaussian): the second stop gives up under a tenth of the centre
    expect(stops[0].share - stops[1].share).toBeLessThan(0.1 * stops[0].share);
    // And the rim is approached without a step: the last stop gives under 3% of the centre
    expect(stops.at(-2)!.share - stops.at(-1)!.share).toBeLessThan(0.03 * stops[0].share);
  });

  it("is softer than the two-stop gradient it replaces at every distance past the core", () => {
    // The old: full alpha at the centre to none at 0.35 of a radius 0.6 of the longer side (0.21 of it, linear)
    const W = 1080, H = 1620;
    const oldReach = 0.21 * H;
    const newReach = bloomRadius(W, H, W * 0.78, H * 0.14);
    expect(newReach).toBeGreaterThan(1.8 * oldReach);
  });

  it("reaches as far as the page's own glow: 42% of the way to the farthest corner", () => {
    expect(bloomRadius(100, 100, 0, 0)).toBeCloseTo(0.42 * Math.hypot(100, 100));
    expect(bloomRadius(100, 200, 50, 100)).toBeCloseTo(0.42 * Math.hypot(50, 100));
  });

  it("reads the palette's own glow, in every state of the sky", () => {
    for (const light of [-0.6, 0, 0.3, 0.5, 0.95, 1.5])
      for (const state of ["CLEAR_DAY", "CLEAR_NIGHT", "CLOUDY", "RAIN", "SNOW"] as const) {
        const c = parseGlow(skyPalette({ light, state, cloudCover: 50, uv: 3 }).glow);
        expect(c, `${state} at ${light}`).not.toBeNull();
        expect(c![3]).toBeGreaterThanOrEqual(0);
        expect(c![3]).toBeLessThanOrEqual(1);
      }
    expect(parseGlow("rgb(254 200 156 / 0.5)")).toEqual([254, 200, 156, 0.5]);
    expect(parseGlow("rgba(10, 20, 30, 0.25)")).toEqual([10, 20, 30, 0.25]);
    expect(parseGlow("rgb(10 20 30)")).toEqual([10, 20, 30, 1]);
    expect(parseGlow("#ffffff")).toBeNull();
  });
});
