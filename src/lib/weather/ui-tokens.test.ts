import { describe, expect, it } from "vitest";
import { fieldColor } from "@/lib/atlas/field-color";
import { FIELD_OPACITY, FIELD_TINT_OPACITY } from "@/constants/atlas";
import type { PointSky } from "@/types/atlas";
import { MAP_TUNING } from "@/lib/map-tuning";
import { atmospherePalette, contrastRatio, mapInksFor, MUTED_INK_ALPHA } from "./palette";
import { computeAtmosphere, type WeatherVisualInput } from "./visual-input";
import { parseColor, SURFACE_1_CONTRAST, SURFACE_2_CONTRAST, thinnestVeil, uiTokens, worstBackdrop } from "./ui-tokens";

type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as RGB;
const alphaOf = (token: string) => Number(/\/\s*([\d.]+)\)$/.exec(token)?.[1]);

/** The seven skies of the design system (DESIGN_SYSTEM.md section 6) */
const SKIES: Record<string, WeatherVisualInput> = {
  clear: { light: 0.5, temp: 16, cloudCover: 5, condition: "clear" },
  golden: { light: 0.92, temp: 14, cloudCover: 20, condition: "clear" },
  rain: { light: 0.5, temp: 9, cloudCover: 95, precipitation: 3, condition: "rain" },
  snow: { light: 0.5, temp: -3, cloudCover: 90, precipitation: 1, condition: "snow" },
  fog: { light: 0.4, temp: 6, cloudCover: 100, visibility: 0.3, humidity: 98, condition: "fog" },
  storm: { light: 0.6, temp: 22, cloudCover: 100, precipitation: 12, condition: "thunderstorm", intensity: "heavy" },
  night: { light: 1.6, temp: 8, cloudCover: 10, condition: "clear" },
};

const skyOf = (input: WeatherVisualInput): PointSky => {
  const p = atmospherePalette(input.light ?? 0.5, computeAtmosphere(input).atmosphere);
  return { sky1: p.sky1, sky2: p.sky2, sky3: p.sky3, glass: p.glass, glow: p.glow, sun: p.sun, cloud: p.cloud, air: p.air };
};

/** Fields as bright as the Atlas draws them: sunny days from cold to hot, and a mild night */
const FIELDS: string[][] = [
  [10, 18, 24, 30, 36].map((temp) => fieldColor({ temp, light: 0.5, cloudCover: 0, precipitation: 0, condition: "clear", intensity: "moderate" })),
  [fieldColor({ temp: -8, light: 0.5, cloudCover: 30, precipitation: 0, condition: "clear", intensity: "moderate" })],
  [fieldColor({ temp: 14, light: 1.6, cloudCover: 0, precipitation: 0, condition: "clear", intensity: "moderate" })],
];

const inksOf = (sky: PointSky) => Object.values(mapInksFor(sky.sky2, MAP_TUNING, undefined, sky.air)).map((i) => i.color);

describe("uiTokens", () => {
  it("keeps muted text at AA on surface-1 and AAA on surface-2 over every sky and every bright field", () => {
    for (const [name, input] of Object.entries(SKIES)) {
      const sky = skyOf(input);
      const inks = inksOf(sky);
      for (const field of FIELDS) {
        const t = uiTokens(sky, field, inks);
        const ground = worstBackdrop(sky, field, inks);
        for (const [token, target] of [["--surface-1", SURFACE_1_CONTRAST], ["--surface-2", SURFACE_2_CONTRAST]] as const) {
          const veil = parseColor(t[token])!;
          const surface = mix(ground, veil, alphaOf(t[token]));
          const ratio = contrastRatio(mix(surface, [255, 255, 255], MUTED_INK_ALPHA), surface);
          expect(ratio, `${name} ${token}`).toBeGreaterThanOrEqual(target);
        }
      }
    }
  });

  it("measures against the field, not only the sky: a bright field asks for a thicker veil than the sky alone", () => {
    const sky = skyOf(SKIES.clear);
    const alone = alphaOf(uiTokens(sky)["--surface-1"]);
    const overField = alphaOf(uiTokens(sky, FIELDS[0], inksOf(sky))["--surface-1"]);
    expect(overField).toBeGreaterThan(alone);
  });

  it("the worst ground is the field as Mapbox draws it, under and over the lines", () => {
    const sky = skyOf(SKIES.clear);
    const hot = fieldColor({ temp: 30, light: 0.5, cloudCover: 0, precipitation: 0, condition: "clear", intensity: "moderate" });
    const ground = worstBackdrop(sky, [hot], []);
    expect(ground).toEqual(mix(parseColor(sky.sky2)!, parseColor(hot)!, FIELD_OPACITY));
    const withInk = worstBackdrop(sky, [hot], ["#ffffff"]);
    expect(withInk).toEqual(mix([255, 255, 255], parseColor(hot)!, FIELD_TINT_OPACITY));
  });

  it("has no ceiling: a white ground ends opaque rather than unreadable", () => {
    expect(thinnestVeil([255, 255, 255], [250, 250, 250], 4.5)).toBe(1);
  });

  it("the accent is the sun and reads at 3:1 on both surfaces in every sky; text on it is the night ink", () => {
    for (const [name, input] of Object.entries(SKIES)) {
      const sky = skyOf(input);
      const t = uiTokens(sky, FIELDS[0], inksOf(sky));
      expect(t["--accent"]).toBe(sky.sun);
      const ground = worstBackdrop(sky, FIELDS[0], inksOf(sky));
      for (const token of ["--surface-1", "--surface-2"] as const) {
        const surface = mix(ground, parseColor(t[token])!, alphaOf(t[token]));
        expect(contrastRatio(parseColor(sky.sun)!, surface), `${name} ${token}`).toBeGreaterThanOrEqual(3);
      }
      expect(contrastRatio(parseColor(t["--on-accent"])!, parseColor(sky.sun)!), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("passes the engine's sky through unchanged, and muted ink is the engine's own alpha", () => {
    const sky = skyOf(SKIES.night);
    const t = uiTokens(sky);
    expect([t["--sky-1"], t["--sky-2"], t["--sky-3"], t["--glass"], t["--sun"]]).toEqual([sky.sky1, sky.sky2, sky.sky3, sky.glass, sky.sun]);
    expect(t["--ink-muted"]).toBe(`rgb(255 255 255 / ${MUTED_INK_ALPHA})`);
  });

  it("reads the engine's two colour forms and refuses others", () => {
    expect(parseColor("#2260af")).toEqual([0x22, 0x60, 0xaf]);
    expect(parseColor("rgb(1 13 34 / 0.340)")).toEqual([1, 13, 34]);
    expect(parseColor("transparent")).toBeNull();
  });
});
