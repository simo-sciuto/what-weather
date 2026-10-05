import type { AtmosphereAxes } from "@/lib/weather/atmosphere";
import { atmospherePalette } from "@/lib/weather/palette";
import { tempColor } from "@/lib/weather/temp-color";
import { HAZE_ONSET } from "@/lib/weather/atmosphere";
import type { InkRole } from "./types";

/**
 * Swiss Flat's four inks, the Type Engine research's print palette (2026-10-05): one near-black ink, one cobalt
 * for water, one red-orange used once (the city's mark), on a paper the atmosphere tints. A record is a print,
 * not the sky on screen: the same four roles on every sheet keep the records one collection.
 */
export const RECORD_INK = "#141413";
export const RECORD_ACCENT = "#E4502A";
/** The paper of cool air, warm air and haze, from the three hand-made posters (Tokyo, Tshuru, Milan) */
export const PAPER = { cool: "#E3E6E7", warm: "#ECE2CF", haze: "#E8E9E5" } as const;
/** Water: cobalt, a touch deeper and bluer in the wet */
export const WATER = { dry: "#2445B0", wet: "#2A3DCC" } as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smoothstep = (lo: number, hi: number, v: number) => {
  const t = clamp((v - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
};

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** `a` at t = 0, `b` at t = 1 */
export function mix(a: string, b: string, t: number): string {
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

export function recordInks(a: AtmosphereAxes): Record<InkRole, string> {
  const warm = mix(PAPER.cool, PAPER.warm, smoothstep(0.1, 0.6, a.warmth));
  const haze = smoothstep(HAZE_ONSET, 1, a.haze);
  return {
    paper: mix(warm, PAPER.haze, haze),
    "ink-1": RECORD_INK,
    "ink-2": mix(WATER.dry, WATER.wet, smoothstep(0.2, 0.8, a.wetness)),
    accent: RECORD_ACCENT,
  };
}

/** The type's ink over the site's own map: the warm white the page sets its type in */
export const MAP_TYPE_INK = "#f3efe6";

/**
 * The inks over the poster's own map (the site's style, its colours from the sky of the moment): the paper is that
 * sky, flattened to one tone, the type is white as on the page, the place's name takes the temperature's colour on
 * the absolute scale (ink-2, as the old poster set it), the city's mark keeps the one accent.
 */
export function mapInks(light: number, a: AtmosphereAxes, temp: number): Record<InkRole, string> {
  const sky = atmospherePalette(light, a).sky2;
  return { paper: sky, "ink-1": MAP_TYPE_INK, "ink-2": tempColor(temp), accent: RECORD_ACCENT };
}
