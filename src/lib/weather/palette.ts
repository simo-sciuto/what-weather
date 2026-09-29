import type { WeatherState } from "./state";

/**
 * The sky's colours, computed rather than picked from a table:
 *  1. a clear-sky palette that follows the light through the day — night,
 *     blue hour, sunrise, golden hour, a soft hazy morning, a bright midday,
 *     a slightly deeper afternoon, golden hour, sunset, blue hour, night;
 *  2. the weather laid over it — clouds desaturate, rain and storms darken,
 *     snow cools;
 *  3. legibility enforced: the whole sky is darkened until even muted text
 *     clears WCAG AA, and the panels' glass thickens just enough where it
 *     still needs to.
 */

type RGB = [number, number, number];
type RGBA = [number, number, number, number];

export interface SkyPalette {
  /** Top, middle and horizon of the sky gradient */
  sky1: string;
  sky2: string;
  sky3: string;
  /** Panel tint */
  glass: string;
  /** The light source's halo, and the solid colour of "now" markers */
  glow: string;
  sun: string;
  cloud: string;
}

/* ---------- Colour helpers ---------- */

const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const toHex = (c: RGB) => "#" + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
const rgba = ([r, g, b, a]: RGBA) => `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)} / ${a.toFixed(3)})`;
const mix = <T extends number[]>(a: T, b: T, t: number) => a.map((v, i) => v + (b[i] - v) * t) as T;
const scale = (c: RGB, k: number) => c.map((v) => v * k) as RGB;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function luminance([r, g, b]: RGB): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

const contrast = (a: RGB, b: RGB) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const WHITE: RGB = [255, 255, 255];
/** Muted text is white at 86% (see --ink-muted) */
const muted = (bg: RGB) => mix(bg, WHITE, 0.86);

/* OKLCH, so a colour can be darkened without losing its hue or its saturation. */

type LCH = [number, number, number];

const toLinear = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

function toOklch([r, g, b]: RGB): LCH {
  const [lr, lg, lb] = [r, g, b].map(toLinear);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
}

/** Back to sRGB; out-of-gamut colours give up chroma (not hue) until they fit. */
function fromOklch([L, C, h]: LCH): RGB {
  for (let c = C; ; c *= 0.95) {
    const A = c * Math.cos(h);
    const B = c * Math.sin(h);
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    const lin = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    if (lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4) || c < 1e-3) return lin.map((v) => fromLinear(clamp01(v))) as RGB;
  }
}

/**
 * Darken until muted (86% white) text reaches `ratio` against it; full white
 * then clears it too. Lightness goes down in OKLCH with the chroma kept, so a
 * peach horizon deepens into a vivid coral rather than dulling to brown.
 */
function legibleUnderText(c: RGB, ratio: number): RGB {
  // Checked on whole channels, as the colour will be written (#rrggbb): rounding
  // can lighten a colour just past the threshold back under it.
  const whole = (x: RGB) => x.map(Math.round) as RGB;
  let out = whole(c);
  if (contrast(muted(out), out) >= ratio) return out;
  const [L, C, h] = toOklch(c);
  for (let l = L; l > 0 && contrast(muted(out), out) < ratio; l -= 0.01) out = whole(fromOklch([l, C, h]));
  return out;
}

/* ---------- 1. Clear sky through the day ---------- */

/**
 * Keyed on the light scale from frames.ts: −1 night … 0 sunrise … 1 sunset … 2 night.
 * Acid pastel: violet nights with a lilac glow, pink and peach dawns, cyan
 * days under a lemon light, magenta and coral sunsets. The hues are vivid on
 * purpose; step 3 below still darkens each one until white text reads on it.
 */
const CLEAR: { at: number; sky: [string, string, string]; glow: RGBA }[] = [
  { at: -1, sky: ["#0b0826", "#1d1350", "#3a2477"], glow: [214, 179, 255, 0.22] },
  { at: -0.4, sky: ["#1e1452", "#4a2d86", "#9a5fb8"], glow: [255, 158, 232, 0.28] },
  { at: 0, sky: ["#2b2e7a", "#c25fa6", "#ffb38a"], glow: [255, 179, 138, 0.6] },
  { at: 0.07, sky: ["#2f5fc0", "#9f8fe0", "#ffc9a8"], glow: [255, 214, 160, 0.55] },
  { at: 0.2, sky: ["#1f78d0", "#58b8e8", "#9ff0e8"], glow: [234, 255, 143, 0.4] },
  { at: 0.45, sky: ["#0f6fd8", "#24a6e8", "#8ff0ff"], glow: [240, 255, 170, 0.55] },
  { at: 0.72, sky: ["#2560c8", "#5a8fe0", "#b8c8ff"], glow: [255, 236, 150, 0.5] },
  { at: 0.9, sky: ["#3a4fb0", "#b07fd0", "#ffb89a"], glow: [255, 190, 150, 0.55] },
  { at: 1, sky: ["#34287a", "#c0508f", "#ff8f7a"], glow: [255, 158, 181, 0.6] },
  { at: 1.4, sky: ["#170f48", "#3a1f6e", "#7a3f8f"], glow: [214, 179, 255, 0.24] },
  { at: 2, sky: ["#0b0826", "#1d1350", "#3a2477"], glow: [214, 179, 255, 0.22] },
];

function clearSky(light: number): { sky: [RGB, RGB, RGB]; glow: RGBA } {
  const u = Math.min(2, Math.max(-1, light));
  const j = Math.max(1, CLEAR.findIndex((k) => k.at >= u));
  const a = CLEAR[j - 1];
  const b = CLEAR[j];
  const t = (u - a.at) / (b.at - a.at || 1);
  return {
    sky: [0, 1, 2].map((i) => mix(hex(a.sky[i]), hex(b.sky[i]), t)) as [RGB, RGB, RGB],
    glow: mix(a.glow, b.glow, t),
  };
}

/* ---------- 2. Weather over the light ---------- */

/** How far each state pulls the sky towards grey, and how much it darkens it. */
const WEATHER: Record<WeatherState, { grey: number; dim: number }> = {
  CLEAR_DAY: { grey: 0, dim: 1 },
  CLEAR_NIGHT: { grey: 0, dim: 1 },
  PARTLY_CLOUDY: { grey: 0.15, dim: 0.97 },
  CLOUDY: { grey: 0.72, dim: 0.9 },
  FOG: { grey: 0.82, dim: 0.95 },
  RAIN: { grey: 0.78, dim: 0.8 },
  HEAVY_RAIN: { grey: 0.86, dim: 0.68 },
  STORM: { grey: 0.88, dim: 0.46 },
  SNOW: { grey: 0.76, dim: 0.95 },
};

/** Overcast grey of the same brightness, a touch cool (snow a touch cooler). */
function overcast(c: RGB, snow: boolean): RGB {
  const y = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  return snow ? [y * 0.94, y * 0.99, y * 1.08] : [y * 0.97, y, y * 1.04];
}

/* ---------- 3. Palette ---------- */

export function skyPalette({
  light,
  state,
  cloudCover,
}: {
  light: number;
  state: WeatherState;
  cloudCover: number;
}): SkyPalette {
  const { sky, glow } = clearSky(light);
  const w = WEATHER[state];
  // Cloud cover greys even a nominally clear or partly cloudy sky a little.
  const grey = clamp01(Math.max(w.grey, (cloudCover / 100) * 0.35));
  const weathered = sky.map((c) => scale(mix(c, overcast(c, state === "SNOW"), grey), w.dim)) as [RGB, RGB, RGB];

  // Text sits on every part of the sky: the reading at the top, and — as the
  // page scrolls over the fixed sky — chapter titles and the footer on the
  // horizon. All of it stays at AA; the glow still brightens the light source.
  const sky1 = legibleUnderText(weathered[0], 4.8);
  const sky2 = legibleUnderText(weathered[1], 4.6);
  const sky3 = legibleUnderText(weathered[2], 4.5);

  // Glass: the thinnest veil over the brightest part of the sky that keeps muted text at AA.
  const veil: RGB = [8, 16, 30];
  // Starts at a clearly frosted panel (the cards read as solid surfaces), thicker where the sky needs it.
  let alpha = 0.34;
  while (alpha < 0.7 && contrast(muted(mix(sky3, veil, alpha)), mix(sky3, veil, alpha)) < 4.6) alpha += 0.02;
  const dark = light < -0.3 || light > 1.3;

  return {
    sky1: toHex(sky1),
    sky2: toHex(sky2),
    sky3: toHex(sky3),
    glass: rgba([...veil, alpha]),
    glow: rgba(glow),
    // The "now" markers: the glow's own colour by day, a pale lilac moonlight at night.
    sun: dark ? "#e9dcff" : toHex([glow[0], glow[1], glow[2]]),
    cloud: rgba(
      state === "RAIN" || state === "HEAVY_RAIN" || state === "STORM"
        ? [205, 214, 226, dark ? 0.07 : 0.2]
        : [255, 255, 255, dark ? 0.06 : 0.2],
    ),
  };
}
