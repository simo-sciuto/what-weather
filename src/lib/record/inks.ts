import type { AtmosphereAxes } from "@/lib/weather/atmosphere";
import { atmospherePalette } from "@/lib/weather/palette";
import { tempColor } from "@/lib/weather/temp-color";
import type { Blend, PrintStyle } from "./types";
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

const luminanceOf = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

/**
 * The inks over the poster's own map, two of them as in a screenprint, both from the atmosphere: the light ink is
 * the moment's own light (`sun`: a warm sun by day, a cold moon at night), the name's ink the temperature's colour
 * on the absolute scale; each a little into the paper, more in haze, so the type sits in the scene rather than
 * cut out of it. The city's mark keeps the one accent.
 */
export function mapInks(light: number, a: AtmosphereAxes, temp: number): Record<InkRole, string> {
  const p = atmospherePalette(light, a);
  const soften = 0.26 + 0.24 * smoothstep(HAZE_ONSET, 1, a.haze);
  const hex = (c: string) => (c.startsWith("#") ? c : `#${(c.match(/\d+/g) ?? ["0", "0", "0"]).slice(0, 3).map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`);
  return {
    paper: p.sky2,
    "ink-1": mix(hex(p.sun), p.sky2, soften),
    "ink-2": mix(hex(tempColor(temp)), p.sky2, soften * 0.6),
    accent: RECORD_ACCENT,
  };
}

/**
 * The print's character from the atmosphere: light inks screen over a dark ground and dark ones multiply over a
 * light one; the second impression drifts with the weather's energy (storm most, then rain, then the sun's), the
 * way the wind blows when it is known. Two flat passes, no ink texture: the user's screenprint.
 */
export function printStyle(a: AtmosphereAxes, paper: string, windDeg?: number): PrintStyle {
  const blend: Blend = luminanceOf(paper) < 0.55 ? "screen" : "multiply";
  const shift = 0.0022 + 0.003 * a.severity + 0.0015 * a.wetness + 0.0008 * a.energy;
  // Downwind: the wind's degrees say where it comes from; with no wind, down and to the right
  const angle = windDeg == null ? Math.PI / 5 : ((windDeg + 180 - 90) * Math.PI) / 180;
  return { blend, offset: [Math.cos(angle) * shift, Math.sin(angle) * shift] };
}
