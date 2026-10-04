import { describe, expect, it } from "vitest";
import type { AtmosphereAxes } from "./atmosphere";
import { CALIBRATION_SCENARIOS } from "./calibration";
import {
  ATMOSPHERE_LIMITS,
  atmospherePalette,
  atmosphereSky,
  skyColors,
  solarPalette,
} from "./palette";
import { computeAtmosphere } from "./visual-input";

type RGB = number[];

/* OKLab, written out here so the tests do not lean on the code they check. */
const lin = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
function oklab(c: RGB): [number, number, number] {
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
const lightness = (c: RGB) => oklab(c)[0];
const chroma = (c: RGB) => Math.hypot(oklab(c)[1], oklab(c)[2]);
const hue = (c: RGB) => Math.atan2(oklab(c)[2], oklab(c)[1]);
const distance = (x: RGB, y: RGB) => {
  const [a, b] = [oklab(x), oklab(y)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
};
const hueGap = (a: number, b: number) =>
  Math.abs((((a - b + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function luminance(c: RGB) {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: RGB, b: RGB) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const muted = (bg: RGB) => bg.map((v) => v + (255 - v) * 0.86);

/** Daylight as the normalized axis has it (WTH-046B) for a Frame.light phase. */
const daylightAt = (light: number) =>
  light <= 0 || light >= 1 ? 0 : Math.min(1, 2 * Math.sin(light * Math.PI));

const NONE = { warmth: 0, cloudiness: 0, haze: 0, wetness: 0, severity: 0, snow: 0 };
/** A plain atmosphere at a light phase, with the UV's neutral reference (energy half the daylight) */
function at(light: number, axes: Partial<AtmosphereAxes> = {}): AtmosphereAxes {
  const daylight = daylightAt(light);
  return { ...NONE, daylight, energy: daylight * 0.5, ...axes };
}

const LIGHTS = Array.from({ length: 31 }, (_, i) => -1 + i * 0.1);
const LEVELS = [0, 0.2, 0.4, 0.6, 0.8, 1];
/** Other axes held at a few settings while one moves, so a monotonic rule is checked in company */
const COMPANY: Partial<AtmosphereAxes>[] = [
  {},
  { cloudiness: 0.6 },
  { haze: 0.7, wetness: 0.3 },
  { warmth: -0.8, snow: 0.4 },
  { warmth: 0.9 },
];
const EPS = 1e-9;

function eachMonotonic(
  axis: keyof typeof NONE,
  measure: (light: number, axes: AtmosphereAxes) => number[],
  direction: "down" | "up",
) {
  for (const light of LIGHTS)
    for (const company of COMPANY) {
      let previous: number[] | null = null;
      for (const level of LEVELS) {
        const now = measure(light, at(light, { ...company, [axis]: level }));
        if (previous)
          now.forEach((v, i) => {
            if (direction === "down") expect(v).toBeLessThanOrEqual(previous![i] + EPS);
            else expect(v).toBeGreaterThanOrEqual(previous![i] - EPS);
          });
        previous = now;
      }
    }
}

describe("atmosphereSky", () => {
  it("is deterministic and hands out fresh arrays", () => {
    const a = at(0.4, { cloudiness: 0.5, haze: 0.6, warmth: 0.3 });
    const first = atmosphereSky(0.4, a);
    const second = atmosphereSky(0.4, a);
    expect(second).toEqual(first);
    expect(second.sky[0]).not.toBe(first.sky[0]);
  });

  it("leaves the solar base as it is when nothing acts on it", () => {
    // At night daylight and energy are zero, so a neutral atmosphere has no say at all.
    for (const light of [-1, -0.5, 1.5, 2]) {
      const base = solarPalette(light);
      const out = atmosphereSky(light, at(light));
      out.sky.forEach((c, i) => c.forEach((v, j) => expect(v).toBeCloseTo(base.sky[i][j], 4)));
      expect(out.glow[3]).toBeCloseTo(base.glow[3], 9);
    }
  });

  it("never lets more cloud raise the glow or the colour", { timeout: 30_000 }, () => {
    eachMonotonic(
      "cloudiness",
      (light, a) => {
        const { sky, glow } = atmosphereSky(light, a);
        return [glow[3], ...sky.map(chroma)];
      },
      "down",
    );
  });

  it("never lets more haze open the depth: the top and the horizon only come closer", { timeout: 30_000 }, () => {
    eachMonotonic(
      "haze",
      (light, a) => {
        const { sky, glow } = atmosphereSky(light, a);
        return [distance(sky[0], sky[2]), glow[3]];
      },
      "down",
    );
  });

  it("never lets heavier rain look lighter or more colourful", { timeout: 30_000 }, () => {
    eachMonotonic(
      "wetness",
      (light, a) => {
        const { sky } = atmosphereSky(light, a);
        return [...sky.map(lightness), ...sky.map(chroma)];
      },
      "down",
    );
  });

  it("deepens the scene and dims the light as a storm grows", { timeout: 30_000 }, () => {
    eachMonotonic(
      "severity",
      (light, a) => {
        const { sky, glow } = atmosphereSky(light, a);
        return [glow[3], lightness(sky[0])];
      },
      "down",
    );
  });

  // A smoke test: the protection is shared with the live sky and would darken any colour to AA; what the
  // atmosphere does under that cap is checked by the orderings below, before protection.
  it("goes through the same text protection as the live sky, in every atmosphere", { timeout: 30_000 }, () => {
    for (const light of LIGHTS)
      for (const company of COMPANY)
        for (const level of [0, 0.5, 1]) {
          const a = at(light, { ...company, wetness: level, severity: level / 2 });
          const { sky1, sky2, sky3 } = skyColors(atmosphereSky(light, a));
          [sky1, sky2, sky3].forEach((hex, i) => {
            const bg = rgb(hex);
            expect(contrast(muted(bg), bg)).toBeGreaterThanOrEqual([4.8, 4.6, 4.5][i]);
          });
        }
  });

  it("tells snow from rain: lighter, and plainly another colour", () => {
    for (const light of LIGHTS)
      for (const level of [0.3, 0.6, 1]) {
        const shared = { cloudiness: 0.9, haze: 0.8 };
        const snow = atmosphereSky(light, at(light, { ...shared, snow: level, warmth: -0.6 }));
        const rain = atmosphereSky(light, at(light, { ...shared, wetness: level, warmth: -0.6 }));
        snow.sky.forEach((c, i) => expect(lightness(c)).toBeGreaterThan(lightness(rain.sky[i])));
        expect(Math.max(...snow.sky.map((c, i) => distance(c, rain.sky[i])))).toBeGreaterThan(0.03);
      }
  });

  it("turns hues no further than its limit", () => {
    const most = (ATMOSPHERE_LIMITS.totalTurn * Math.PI) / 180;
    for (const light of LIGHTS)
      for (const level of LEVELS) {
        // Temperature only shifts the white balance and haze only mixes: the turns are the precipitation's.
        const base = solarPalette(light);
        const out = atmosphereSky(light, { ...at(light), wetness: level, snow: level, severity: level, energy: 0, daylight: 0 });
        out.sky.forEach((c, i) => {
          if (chroma(base.sky[i]) < 0.03 || chroma(c) < 0.03) return;
          expect(hueGap(hue(c), hue(base.sky[i]))).toBeLessThanOrEqual(most + 1e-6);
        });
      }
  });

  it("never turns a sky or its glow green", { timeout: 30_000 }, () => {
    // The green side of the wheel, which no solar stop or glow sits on
    const isGreen = (c: RGB) => chroma(c) > 0.02 && hueGap(hue(c), (140 * Math.PI) / 180) < (30 * Math.PI) / 180;
    const extremes = [0, 1];
    for (const light of LIGHTS) {
      const base = solarPalette(light);
      for (const warmth of [-1, 0, 1])
        for (const haze of extremes)
          for (const wetness of extremes)
            for (const snow of extremes)
              for (const severity of extremes) {
                const out = atmosphereSky(light, at(light, { warmth, haze, wetness, snow, severity, cloudiness: 0.5 }));
                out.sky.forEach((c, i) => {
                  if (!isGreen(base.sky[i])) expect(isGreen(c)).toBe(false);
                });
                const glow = out.glow.slice(0, 3);
                expect(isGreen(glow) && !isGreen(base.glow.slice(0, 3))).toBe(false);
              }
    }
  });

  it("turns a warm stop away from green, the long way round to slate", () => {
    // A sunset horizon (coral) turned towards rain's slate must not take the short way through yellow
    const green = (140 * Math.PI) / 180;
    for (const light of [0, 0.95, 1]) {
      const base = solarPalette(light).sky[2];
      const wet = atmosphereSky(light, { ...at(light), wetness: 1, daylight: 0, energy: 0 }).sky[2];
      expect(hueGap(hue(wet), green)).toBeGreaterThan(hueGap(hue(base), green));
    }
  });

  it("only whitens the glow in the cold, never tints it", () => {
    for (const light of [0.2, 0.5, 0.8]) {
      const base = solarPalette(light).glow.slice(0, 3);
      const cold = atmosphereSky(light, at(light, { warmth: -1 })).glow.slice(0, 3);
      expect(hueGap(hue(cold), hue(base))).toBeLessThan(0.01);
      expect(chroma(cold)).toBeLessThan(chroma(base));
    }
  });

  it("keeps every stop above its floors, whatever piles up", () => {
    const { dimFloor, chromaFloor } = ATMOSPHERE_LIMITS;
    for (const light of LIGHTS) {
      const base = solarPalette(light);
      for (const level of [0.5, 1])
        for (const snow of [0, 1])
        for (const energy of [0, 1]) {
          const daylight = daylightAt(light);
          const a = { warmth: -level, cloudiness: level, haze: level, wetness: level, severity: level, snow, daylight, energy: energy * daylight };
          atmosphereSky(light, a).sky.forEach((c, i) => {
            expect(lightness(c)).toBeGreaterThanOrEqual(dimFloor * lightness(base.sky[i]) - 0.002);
            expect(chroma(c)).toBeGreaterThanOrEqual(chromaFloor * chroma(base.sky[i]) - 0.002);
          });
        }
    }
  });

  it("cools snowy fog into a blue white even at dusk, never lilac or magenta", () => {
    const snowPole = (225 * Math.PI) / 180;
    for (const light of [-0.2, 0, 0.05, 0.9, 1, 1.1]) {
      const out = atmosphereSky(light, at(light, { snow: 1, haze: 1, cloudiness: 0.9, warmth: -0.6 }));
      out.sky.forEach((c) => {
        if (chroma(c) > 0.015) expect(hueGap(hue(c), snowPole)).toBeLessThan((60 * Math.PI) / 180);
      });
    }
  });

  it("leaves a humid but perfectly clear noon as vivid as a dry one", () => {
    // Saturated air alone gives haze up to 0.45, which must not dull a clear sky
    const dry = atmosphereSky(0.5, at(0.5, { haze: 0 }));
    const humid = atmosphereSky(0.5, at(0.5, { haze: ATMOSPHERE_LIMITS.hazeOnset }));
    expect(humid).toEqual(dry);
  });

  it("keeps a hot clear day a clear sky, not an orange theme", () => {
    for (const light of [0.3, 0.45, 0.6]) {
      const base = solarPalette(light);
      const hot = atmosphereSky(light, at(light, { warmth: 1, energy: daylightAt(light) }));
      hot.sky.slice(0, 2).forEach((c, i) => {
        expect(hueGap(hue(c), hue(base.sky[i]))).toBeLessThan((15 * Math.PI) / 180);
        expect(chroma(c)).toBeGreaterThan(0.8 * chroma(base.sky[i]));
      });
    }
  });

  it("keeps a trace of the sunset under a full overcast", () => {
    const base = solarPalette(1);
    const out = atmosphereSky(1, at(1, { cloudiness: 1 }));
    expect(chroma(out.sky[2])).toBeGreaterThan(0.15 * chroma(base.sky[2]));
    expect(hueGap(hue(out.sky[2]), hue(base.sky[2]))).toBeLessThan((25 * Math.PI) / 180);
  });

  it("changes a little when an axis changes a little: no jumps", { timeout: 30_000 }, () => {
    const axes = ["warmth", "cloudiness", "haze", "wetness", "severity", "snow"] as const;
    for (const light of LIGHTS)
      for (const company of COMPANY)
        for (const axis of axes)
          for (const level of [0.1, 0.45, 0.9]) {
            const a = at(light, { ...company, [axis]: level });
            const b = { ...a, [axis]: level + 0.001 };
            const [x, y] = [atmosphereSky(light, a), atmosphereSky(light, b)];
            x.sky.forEach((c, i) => c.forEach((v, j) => expect(Math.abs(v - y.sky[i][j])).toBeLessThan(1.5)));
            expect(Math.abs(x.glow[3] - y.glow[3])).toBeLessThan(0.005);
          }
  });
});

describe("calibration scenarios", () => {
  const look = (id: string) => {
    const s = CALIBRATION_SCENARIOS.find((x) => x.id === id)!;
    const { atmosphere } = computeAtmosphere(s.input);
    const colors = skyColors(atmosphereSky(s.input.light, atmosphere));
    const stops = [colors.sky1, colors.sky2, colors.sky3].map(rgb);
    return { stops, mean: stops.reduce((sum, c) => sum + lightness(c), 0) / 3 };
  };

  it("are named for the weather they stand for, each once", () => {
    const ids = CALIBRATION_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(15);
  });

  it("order them by the transform itself, before text protection caps the light ones", () => {
    const raw = (id: string) => {
      const sc = CALIBRATION_SCENARIOS.find((x) => x.id === id)!;
      const { sky } = atmosphereSky(sc.input.light, computeAtmosphere(sc.input).atmosphere);
      return sky.reduce((sum, c) => sum + lightness(c), 0) / 3;
    };
    expect(raw("thunderstorm")).toBeLessThan(raw("heavy-rain"));
    expect(raw("heavy-rain")).toBeLessThan(raw("dense-fog"));
    expect(raw("heavy-rain")).toBeLessThan(raw("snow"));
  });

  it("order the wet ones from light rain to a thunderstorm, darkest last", () => {
    expect(look("heavy-rain").mean).toBeLessThan(look("light-rain").mean);
    expect(look("thunderstorm").mean).toBeLessThan(look("heavy-rain").mean);
  });

  it("keep fog and snow lighter than heavy rain", () => {
    expect(look("dense-fog").mean).toBeGreaterThan(look("heavy-rain").mean);
    expect(look("snow").mean).toBeGreaterThan(look("heavy-rain").mean);
  });

  it("flatten the sky in fog and keep it deep on a clear day", () => {
    const depth = (id: string) => {
      const { stops } = look(id);
      return distance(stops[0], stops[2]);
    };
    expect(depth("dense-fog")).toBeLessThan(0.5 * depth("clear-summer-noon"));
  });

  it("give every scenario a palette whose text stays legible", () => {
    for (const s of CALIBRATION_SCENARIOS) {
      const { atmosphere } = computeAtmosphere(s.input);
      const p = atmospherePalette(s.input.light, atmosphere);
      [p.sky1, p.sky2, p.sky3].forEach((hex, i) => {
        const bg = rgb(hex);
        expect(contrast(muted(bg), bg)).toBeGreaterThanOrEqual([4.8, 4.6, 4.5][i]);
      });
      expect(p.glow).toMatch(/^rgb\(\d+ \d+ \d+ \/ [\d.]+\)$/);
    }
  });
});
