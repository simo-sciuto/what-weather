import { describe, expect, it } from "vitest";
import { SKY_FAR_WEIGHT, SKY_ZOOM_LOCAL, SKY_ZOOM_REGIONAL } from "@/constants/atlas";
import { atmospherePalette, CLEAR_MAP } from "@/lib/weather/palette";
import { computeAtmosphere } from "@/lib/weather/visual-input";
import type { PointSky } from "@/types/atlas";
import { mixColor, skyFor, skyWeight } from "./sky";

/* ADR-023, M5: the sky by zoom. Pure: no map, no React. The palettes are the real engine's, not stand-ins. */

const skyOf = (light: number, condition: "clear" | "rain"): PointSky => {
  const p = atmospherePalette(light, computeAtmosphere({ light, condition }).atmosphere);
  return { sky1: p.sky1, sky2: p.sky2, sky3: p.sky3, glass: p.glass, glow: p.glow, sun: p.sun, cloud: p.cloud, air: p.air };
};
const BASE = skyOf(0.5, "clear");
/** How far two #rrggbb colours are, over all three channels */
const distance = (a: string, b: string) => Math.hypot(...[1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)));
const NIGHT_RAIN = skyOf(0.02, "rain");

describe("how local the colour is", () => {
  it("is the far weight from far, 1 from close, and never falls as the map comes closer", () => {
    expect(skyWeight(0)).toBe(SKY_FAR_WEIGHT);
    expect(skyWeight(SKY_ZOOM_REGIONAL)).toBe(SKY_FAR_WEIGHT);
    expect(skyWeight(SKY_ZOOM_LOCAL)).toBe(1);
    expect(skyWeight(22)).toBe(1);
    let last = 0;
    for (let z = 0; z <= 22; z += 0.25) {
      expect(skyWeight(z)).toBeGreaterThanOrEqual(last);
      last = skyWeight(z);
    }
  });
});

describe("mixing two colours", () => {
  it("reads the three forms the palette writes, and gives the ends back as they were", () => {
    expect(mixColor("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixColor("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mixColor("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixColor("rgb(0 0 0 / 0.200)", "rgb(100 200 50 / 0.600)", 0.5)).toBe("rgb(50 100 25 / 0.400)");
    expect(mixColor("rgba(0, 0, 0, 0.5)", "#ffffff", 1)).toBe("#ffffff");
  });

  it("never writes a broken value: a colour it cannot read is the nearer end", () => {
    expect(mixColor("oklch(0.5 0.1 200)", "#ffffff", 0.2)).toBe("oklch(0.5 0.1 200)");
    expect(mixColor("oklch(0.5 0.1 200)", "#ffffff", 0.8)).toBe("#ffffff");
  });
});

describe("the sky for a point", () => {
  it("is the neutral sky with no point, at any zoom", () => {
    expect(skyFor(null, 3, BASE)).toBe(BASE);
    expect(skyFor(null, 14, BASE)).toBe(BASE);
  });

  it("is the point's own sky from close, to the colour", () => {
    const close = skyFor({ sky: NIGHT_RAIN }, 14, BASE);
    expect(close.sky1).toBe(mixColor(BASE.sky1, NIGHT_RAIN.sky1, 1));
    expect(close.sky2).toBe(NIGHT_RAIN.sky2);
    expect(close.air).toEqual(NIGHT_RAIN.air);
  });

  it("from far is a tint of it: nearer the neutral sky than the point's, and not the neutral sky itself", () => {
    const far = skyFor({ sky: NIGHT_RAIN }, 3, BASE);
    expect(far.sky1).not.toBe(BASE.sky1);
    expect(far.sky1).not.toBe(NIGHT_RAIN.sky1);
    expect(distance(far.sky1, BASE.sky1)).toBeLessThan(distance(far.sky1, NIGHT_RAIN.sky1));
  });

  it("moves from the neutral sky to the point's as the map comes close, never turning back", () => {
    const away = [3, 5, 6, 7, 8, 9, 10, 12].map((z) => distance(skyFor({ sky: NIGHT_RAIN }, z, BASE).sky1, BASE.sky1));
    for (let i = 1; i < away.length; i++) expect(away[i]).toBeGreaterThanOrEqual(away[i - 1] - 1);
    expect(away.at(-1)! - away[0]).toBeGreaterThan(20);
  });

  it("keeps the air between clear air and the point's, never outside it", () => {
    const mid = skyFor({ sky: NIGHT_RAIN }, 7.5, BASE).air;
    for (const k of Object.keys(CLEAR_MAP) as (keyof typeof CLEAR_MAP)[]) {
      const [lo, hi] = [BASE.air[k], NIGHT_RAIN.air[k]].sort((x, y) => x - y);
      expect(mid[k]).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(mid[k]).toBeLessThanOrEqual(hi + 1e-9);
    }
  });
});
