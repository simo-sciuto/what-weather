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
  };
}

/** The page's type colour, white over the sky (globals.css) */
export const PAGE_INK = "#ffffff";

/**
 * The inks over the poster's own map, from the colour study already in the app and nothing else: the paper is the
 * sky of the moment (`atmospherePalette`), the small type is the page's white, and the place's name and the
 * temperature carry the temperature's colour on the absolute scale (`tempColor`, ADR-012: a temperature's figure
 * never takes a weathered colour), as the page and the old poster set them. The city's mark keeps the one accent.
 */
export function mapInks(light: number, a: AtmosphereAxes, temp: number): Record<InkRole, string> {
  const p = atmospherePalette(light, a);
  const [r, g, b] = (tempColor(temp).match(/\d+/g) ?? ["255", "255", "255"]).slice(0, 3).map(Number);
  return {
    paper: p.sky2,
    "ink-1": PAGE_INK,
    "ink-2": `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`,
    accent: RECORD_ACCENT,
    brand: BRAND_BUTTER,
  };
}
