import type { AtmosphereAxes } from "@/lib/weather/atmosphere";
import { atmospherePalette, scaleChroma } from "@/lib/weather/palette";
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

/** The two inks' hues stay at least this far apart, in degrees */
export const MIN_HUE_APART = 110;

/** Hue (degrees), saturation and lightness (0..1) of a hex colour */
function hsl(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function fromHsl(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return `#${[f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`;
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
  // Haze takes a little from both inks; never so much that the two stop reading as two
  const soften = 0.1 * smoothstep(HAZE_ONSET, 1, a.haze);
  const toHex = ([r, g, b]: readonly number[]) => `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
  const channels = (c: string) => (c.startsWith("#") ? rgb(c) : (c.match(/\d+/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number));
  // The colour ink: the temperature's hue, pushed to a printing ink's strength
  const [r, g, b] = channels(tempColor(temp));
  const colour = toHex(scaleChroma([r, g, b], 2.4));
  // The two inks always part on the colour wheel: when the moment's light sits near the temperature's hue (a warm
  // sun on a hot day), the light ink takes the opposite hue, kept pale so it reads on the map
  let lightInk = toHex(channels(p.sun));
  const [h1] = hsl(lightInk);
  const [h2] = hsl(colour);
  const apart = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2));
  if (apart < MIN_HUE_APART) lightInk = fromHsl((h2 + 180) % 360, 0.75, 0.82);
  return {
    paper: p.sky2,
    "ink-1": mix(lightInk, p.sky2, soften),
    "ink-2": mix(colour, p.sky2, soften),
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
  // At least about ten pixels on the preview (fifty on the print), more with the weather's energy
  const shift = 0.02 + 0.006 * a.severity + 0.003 * a.wetness + 0.002 * a.energy;
  // Downwind: the wind's degrees say where it comes from; with no wind, down and to the right
  const angle = windDeg == null ? Math.PI / 5 : ((windDeg + 180 - 90) * Math.PI) / 180;
  return { blend, offset: [Math.cos(angle) * shift, Math.sin(angle) * shift] };
}
