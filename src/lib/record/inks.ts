import type { AtmosphereAxes } from "@/lib/weather/atmosphere";
import { atmospherePalette } from "@/lib/weather/palette";
import { HAZE_ONSET } from "@/lib/weather/atmosphere";
import type { InkRole } from "./types";

/**
 * Swiss Flat's four inks, the Type Engine research's print palette (2026-10-05): one near-black ink, one cobalt
 * for water, one red-orange used once (the city's mark), on a paper the atmosphere tints. A record is a print,
 * not the sky on screen: the same four roles on every sheet keep the records one collection.
 */
export const RECORD_INK = "#141413";
export const RECORD_ACCENT = "#E4502A";
/** The ground a hole in the map shows: a paper white, never the screen's pure white */
export const HOLE_GROUND = "#f2eee6";
/** The wordmark's bar, the page's butter (`--butter` in globals.css) */
export const BRAND_BUTTER = "#f9e8a7";
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
    brand: BRAND_BUTTER,
    hole: mix(warm, PAPER.haze, 0.5),
  };
}

/** The page's type colour, white over the sky (globals.css) */
export const PAGE_INK = "#ffffff";

/**
 * The inks over the poster's own map, from the atmosphere engine only: the paper is the sky of the moment
 * (`atmospherePalette`), the small type the page's white, the place's name the moment's own light, and the ground
 * seen through the temperature's hole that light taken far toward the sky. The city's mark keeps the one accent.
 * The temperature is a hole, not a figure here, so it does not take the absolute temperature scale (ADR-012).
 */
export function mapInks(daylight: number, a: AtmosphereAxes): Record<InkRole, string> {
  const p = atmospherePalette(daylight, a);
  // Every ink a little into the sky of the moment, so the type sits in the scene instead of shouting over it. The
  // moment's own light: a warm sun by day, a cold moon at night
  const light = p.sun.startsWith("#") ? p.sun : HOLE_GROUND;
  return {
    paper: p.sky2,
    "ink-1": mix(PAGE_INK, p.sky2, 0.14),
    // The place's name (and its region on the sheet): the moment's own light, nearly whole, so it shines
    "ink-2": mix(light, p.sky2, 0.12),
    accent: RECORD_ACCENT,
    brand: BRAND_BUTTER,
    // The ground seen through the hole: the same light taken far toward the sky, so the temperature stays quiet
    hole: mix(light, p.sky2, 0.64),
  };
}
