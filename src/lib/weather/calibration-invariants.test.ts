import { describe, expect, it } from "vitest";
import type { AtmosphereAxes } from "./atmosphere";
import { CALIBRATION_SCENARIOS, type CalibrationScenario } from "./calibration";
import { atmosphereDepth, atmospherePalette, atmosphereSky, inkOverSky, skyColors } from "./palette";
import { computeAtmosphere } from "./visual-input";

/* WTH-046K: the invariants that need a scenario, a timeline or a pair of forces. The per-axis rules are in atmosphere-sky.test.ts. */

/* OKLab, written out here so the tests do not lean on the code they check. */
const lin = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function oklab(c: number[]): [number, number, number] {
  const [r, g, b] = c.map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
const lightness = (hex: string) => oklab(rgb(hex))[0];
const scenario = (id: string): CalibrationScenario => CALIBRATION_SCENARIOS.find((x) => x.id === id)!;
const luminance = (c: number[]) => {
  const [r, g, b] = c.map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: number[], b: number[]) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const mutedOn = (bg: number[]) => bg.map((v) => v + (255 - v) * 0.86);
const palette = (sc: CalibrationScenario, light = sc.input.light) =>
  atmospherePalette(light, computeAtmosphere({ ...sc.input, light }).atmosphere);

describe("grayscale", () => {
  /** The three sky stops' lightness: what is left of the sky with no colour */
  const gray = (id: string) => {
    const p = palette(scenario(id));
    return [lightness(p.sky1), lightness(p.sky2), lightness(p.sky3)];
  };
  const apart = (a: string, b: string) => Math.hypot(...gray(a).map((v, i) => v - gray(b)[i]));

  it("tells the dark atmospheres from the bright ones, and a storm from heavy rain", () => {
    expect(apart("heavy-rain", "dense-fog")).toBeGreaterThan(0.1);
    expect(apart("heavy-rain", "snow")).toBeGreaterThan(0.1);
    expect(apart("thunderstorm", "heavy-rain")).toBeGreaterThan(0.1);
    expect(apart("overcast-night", "clear-summer-noon")).toBeGreaterThan(0.4);
  });

  it("tells fog and snow from every other fall by the map's depth, since the sky cannot (white-text cap)", () => {
    const farGround = (id: string) => {
      const p = palette(scenario(id));
      return (["green", "relief", "contours"] as const).reduce((sum, l) => sum + p.map[l].opacity, 0);
    };
    // Fog closes the far ground; rain, snow and a clear day keep it
    expect(farGround("dense-fog")).toBeLessThan(0.5 * farGround("snow"));
    expect(farGround("dense-fog")).toBeLessThan(0.5 * farGround("heavy-rain"));
    expect(farGround("dense-fog")).toBeLessThan(0.5 * farGround("clear-summer-noon"));
  });

  it("known limit, to be lifted by WTH-046G: bright days (clear, rain, snow) share one grayscale, sky and map", () => {
    // The white-text contract caps the sky's lightness near 0.5, and their depth is whole too. The whole picture
    // is the sky's three stops and eight map layers' lightness over the sky; the bright days stay within 0.047 of
    // one another (0.016 by sky alone) while fog is 0.185 from a clear day. When map hierarchy (G) separates
    // them, this fires: replace it with an assertion that they differ.
    const layers = ["water", "streets", "main-roads", "motorways", "green", "relief", "contours", "buildings"] as const;
    const picture = (id: string) => {
      const p = palette(scenario(id));
      return [p.sky1, p.sky2, p.sky3].map(lightness).concat(layers.map((l) => lightness(inkOverSky(p.sky2, p.map[l]))));
    };
    const whole = (a: string, b: string) => Math.hypot(...picture(a).map((v, i) => v - picture(b)[i]));
    const bright = ["clear-summer-noon", "light-rain", "snow", "maritime-rain", "northern-snow"];
    for (const a of bright) for (const b of bright) expect(whole(a, b)).toBeLessThan(0.06);
    expect(whole("dense-fog", "clear-summer-noon")).toBeGreaterThan(0.1);
  });
});

describe("timeline", () => {
  const rgbs = (p: ReturnType<typeof atmospherePalette>) => [rgb(p.sky1), rgb(p.sky2), rgb(p.sky3)];
  const glowAlpha = (p: ReturnType<typeof atmospherePalette>) => parseFloat(p.glow.split("/")[1]);
  /** The largest step of any channel between lights 0.01 apart (about seven minutes of a day), over a range of the day */
  function sweep(sc: CalibrationScenario, from: number, to: number) {
    let channel = 0;
    let glow = 0;
    let prev: ReturnType<typeof atmospherePalette> | null = null;
    for (let l = from; l <= to + 1e-9; l += 0.01) {
      const p = palette(sc, l);
      if (prev) {
        const [a, b] = [rgbs(prev), rgbs(p)];
        a.forEach((c, i) => c.forEach((v, j) => (channel = Math.max(channel, Math.abs(v - b[i][j])))));
        glow = Math.max(glow, Math.abs(glowAlpha(prev) - glowAlpha(p)));
      }
      prev = p;
    }
    return { channel, glow };
  }

  it("moves without jumps through the day, in every scenario", { timeout: 60_000 }, () => {
    for (const sc of CALIBRATION_SCENARIOS) {
      // Round the day, the veil takes the horizon's hue, which the solar base turns fast at dawn: a step of 11 at most
      const whole = sweep(sc, -1, 2);
      expect(whole.channel, `${sc.id} over the whole day`).toBeLessThanOrEqual(12);
      expect(whole.glow, `${sc.id} glow`).toBeLessThanOrEqual(0.02);
      // By day the sky is smooth: the stepped gamut and text protection made a clear noon wander by 14 (found by this test)
      expect(sweep(sc, 0.2, 0.8).channel, `${sc.id} by day`).toBeLessThanOrEqual(9);
    }
  });

  it("moves without jumps as the measurements change, from a clear day to a thick fog", () => {
    const [from, to] = [scenario("mediterranean-sun").input, scenario("dense-fog").input];
    const keys = ["temp", "cloudCover", "humidity", "visibility", "dewPoint", "uvIndex"] as const;
    let prev: ReturnType<typeof atmospherePalette> | null = null;
    let worst = 0;
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const input = { ...from, light: 0.45, condition: "clear" as const, precipitation: 0 };
      for (const k of keys) input[k] = from[k]! + (to[k]! - from[k]!) * t;
      const { atmosphere } = computeAtmosphere(input);
      const p = atmospherePalette(0.45, atmosphere);
      if (prev) rgbs(p).forEach((c, i) => c.forEach((v, j) => (worst = Math.max(worst, Math.abs(v - rgbs(prev!)[i][j])))));
      prev = p;
    }
    expect(worst).toBeLessThanOrEqual(8);
  });
});

describe("conflicting forces", () => {
  const NONE = { warmth: 0, cloudiness: 0, haze: 0, wetness: 0, severity: 0, snow: 0, daylight: 1, energy: 0.5 };
  const axes = (over: Partial<AtmosphereAxes>): AtmosphereAxes => ({ ...NONE, ...over });
  const stops = (a: AtmosphereAxes) => {
    const { sky1, sky2, sky3 } = skyColors(atmosphereSky(0.5, a), true);
    return [sky1, sky2, sky3].map(rgb);
  };
  const meanL = (a: AtmosphereAxes) => stops(a).reduce((sum, c) => sum + oklab(c)[0], 0) / 3;
  const warmB = (a: AtmosphereAxes) => stops(a).reduce((sum, c) => sum + oklab(c)[2], 0) / 3;
  const apart = (a: AtmosphereAxes, b: AtmosphereAxes) => {
    const [x, y] = [stops(a), stops(b)];
    return Math.max(...x.map((c, i) => Math.hypot(...oklab(c).map((v, j) => v - oklab(y[i])[j]))));
  };

  it("keeps a storm in fog darker than the fog and no more open than the storm: haze never opens the depth", () => {
    const fog = axes({ cloudiness: 0.9, haze: 1 });
    const storm = axes({ cloudiness: 0.9, wetness: 1, severity: 1 });
    const both = axes({ cloudiness: 0.9, haze: 1, wetness: 1, severity: 1 });
    expect(meanL(both)).toBeLessThan(meanL(fog));
    // Not lighter than the storm alone by design: the veil stops at the white-text cap, below a clear noon's horizon
    const spread = (a: AtmosphereAxes) => oklab(stops(a)[2])[0] - oklab(stops(a)[0])[0];
    // In a full storm with rain the floors (45% of the base lightness) already pin every stop, so haze has
    // no sky left to compress (0.121 against 0.124 here): a known limit, the map's depth carries it (WTH-046K)
    expect(Math.abs(spread(both))).toBeLessThanOrEqual(Math.abs(spread(storm)) + 0.005);
    // With a lesser storm, haze does compress
    const lesser = axes({ cloudiness: 0.9, severity: 0.5 });
    expect(Math.abs(spread({ ...lesser, haze: 1 }))).toBeLessThan(Math.abs(spread(lesser)));
  });

  it("tells 90% cloud with fog from 90% cloud with a thunderstorm", () => {
    const fog = axes({ cloudiness: 0.9, haze: 1 });
    const storm = axes({ cloudiness: 0.9, wetness: 0.7, severity: 1 });
    expect(apart(fog, storm)).toBeGreaterThan(0.1);
  });

  it("keeps mixed rain and snow between the two", () => {
    const rain = axes({ cloudiness: 1, wetness: 0.8 });
    const snow = axes({ cloudiness: 1, snow: 0.8 });
    const mixed = axes({ cloudiness: 1, wetness: 0.8, snow: 0.8 });
    const [lo, hi] = [Math.min(meanL(rain), meanL(snow)), Math.max(meanL(rain), meanL(snow))];
    expect(meanL(mixed)).toBeGreaterThanOrEqual(lo - 0.02);
    expect(meanL(mixed)).toBeLessThanOrEqual(hi + 0.02);
  });

  it("leaves warm fog warmer than cold fog, and the cold rain no warmer than the warm one", () => {
    const fog = (warmth: number) => axes({ haze: 1, warmth });
    expect(warmB(fog(0.9))).toBeGreaterThan(warmB(fog(-0.9)));
    const rain = (warmth: number) => axes({ cloudiness: 1, wetness: 0.8, warmth });
    expect(warmB(rain(0.9))).toBeGreaterThanOrEqual(warmB(rain(-0.9)));
  });

  it("keeps white text legible on every stop of every conflict pile-up", () => {
    const conflicts = [
      axes({ haze: 1, wetness: 1, severity: 1, cloudiness: 1 }),
      axes({ haze: 1, snow: 1, cloudiness: 1, warmth: -1 }),
      axes({ haze: 1, warmth: 1, energy: 1 }),
      axes({ wetness: 1, snow: 1, severity: 1 }),
    ];
    for (const a of conflicts)
      for (const light of [-0.5, 0.05, 0.5, 0.95, 1.5]) {
        const { sky1, sky2, sky3 } = skyColors(atmosphereSky(light, { ...a, daylight: light <= 0 || light >= 1 ? 0 : a.daylight, energy: light <= 0 || light >= 1 ? 0 : a.energy }), true);
        [sky1, sky2, sky3].forEach((hex, i) => {
          const bg = rgb(hex);
          expect(contrast(mutedOn(bg), bg), `${hex} at light ${light}`).toBeGreaterThanOrEqual([4.8, 4.6, 4.5][i] - 0.02);
        });
      }
    expect(atmosphereDepth(conflicts[0])).toBe(0);
  });
});
