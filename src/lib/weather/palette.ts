import { HAZE_ONSET, type AtmosphereAxes } from "./atmosphere";
import type { WeatherState } from "./state";

/**
 * The sky's colours, computed rather than picked from a table:
 *  1. a solar base that follows natural light through the day: night,
 *     blue hour, sunrise, golden hour, a soft hazy morning, a bright midday,
 *     a slightly deeper afternoon, golden hour, sunset, blue hour, night;
 *  2. the weather laid over it — clouds desaturate, rain and storms darken,
 *     snow cools;
 *  3. the strength of the sun — by day the colours are as vivid as the UV
 *     index is high: dull under a weak sun, brilliant under a strong one;
 *  4. legibility enforced: the whole sky is darkened until even muted text
 *     clears WCAG AA, and the panels' glass thickens just enough where it
 *     still needs to.
 */

type RGB = [number, number, number];
type RGBA = [number, number, number, number];

/** Natural-light base before weather, UV, text protection or map generation. */
export interface SolarPalette {
  /** Top, middle and horizon; interpolated sRGB channels in 0..255. */
  sky: [RGB, RGB, RGB];
  /** Light-source colour in 0..255, followed by alpha in 0..1. */
  glow: RGBA;
}

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
  /** The city drawn behind the page, one entry per map layer */
  map: Record<MapLayer, MapInk>;
}

/**
 * The first five are the city as it always is; the rest are the layers the
 * viewer may add (see map-options.ts), each coloured like the others.
 */
export type MapLayer =
  | "water"
  | "waterway"
  | "streets"
  | "main-roads"
  | "motorways"
  | "green"
  | "relief"
  | "contours"
  | "train"
  | "train-stops"
  | "metro"
  | "metro-stops"
  | "tram"
  | "tram-stops"
  | "bus-stops"
  | "buildings"
  | "buildings-3d"
  | "shadows"
  | "traffic-slow"
  | "traffic-heavy"
  | "traffic-jam"
  | "lights";
export interface MapInk {
  color: string;
  opacity: number;
  /** Layers that colour by value also carry a set of colours: the elevation's ramp (low to high), the traffic's one per rank of road (streets, main roads, motorways) */
  ramp?: string[];
}

/** How many colours the contours' ramp has, and how far round the colour wheel it turns from lowland to peak */
export const ELEVATION_STEPS = 7;
const ELEVATION_SWEEP = 180;

/* ---------- Colour helpers ---------- */

const hex = (h: string): RGB =>
  [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const toHex = (c: RGB) =>
  "#" +
  c
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
const rgba = ([r, g, b, a]: RGBA) =>
  `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)} / ${a.toFixed(3)})`;
const mix = <T extends number[]>(a: T, b: T, t: number) =>
  a.map((v, i) => v + (b[i] - v) * t) as T;
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
const fromLinear = (v: number) =>
  255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

function toOklch([r, g, b]: RGB): LCH {
  const [lr, lg, lb] = [r, g, b].map(toLinear);
  const l = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
  );
  const m = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
  );
  const s = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
  );
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
    if (lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4) || c < 1e-3)
      return lin.map((v) => fromLinear(clamp01(v))) as RGB;
  }
}

/**
 * `fromOklch` for what moves with the clock: the same lightness and hue, but a colour out of gamut gives up
 * only as much chroma as it must (the edge, found by bisection), not a 5% step at a time. The steps make
 * the result jump between levels, and near the sRGB edge a tiny change of light moved a channel by 10 or
 * more (WTH-046K). The live page keeps `fromOklch` unchanged.
 */
function fromOklchEdge([L, C, h]: LCH): RGB {
  const fits = (c: number) => {
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
    return { lin, ok: lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4) };
  };
  let best = fits(C);
  if (!best.ok) {
    let [lo, hi] = [0, C];
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      const t = fits(mid);
      if (t.ok) {
        lo = mid;
        best = t;
      } else hi = mid;
    }
    if (!best.ok) best = fits(0);
  }
  return best.lin.map((v) => fromLinear(clamp01(v))) as RGB;
}

const whole = (x: RGB) => x.map(Math.round) as RGB;

/** Straight distance in OKLab, where equal steps are about equally visible: 0.02 is the least that can be told apart, 0.1 is plainly another colour. */
function oklabDistance(a: RGB, b: RGB): number {
  const [La, Ca, ha] = toOklch(a);
  const [Lb, Cb, hb] = toOklch(b);
  return Math.hypot(
    La - Lb,
    Ca * Math.cos(ha) - Cb * Math.cos(hb),
    Ca * Math.sin(ha) - Cb * Math.sin(hb),
  );
}

/** How far apart two colours (#rrggbb) look, in OKLab; see `oklabDistance`. */
export function colorDistance(a: string, b: string): number {
  return oklabDistance(hex(a), hex(b));
}

/**
 * Darken until muted (86% white) text reaches `ratio` against it; full white
 * then clears it too. Lightness goes down in OKLCH with the chroma kept, so a
 * peach horizon deepens into a vivid coral rather than dulling to brown.
 */
function legibleUnderText(c: RGB, ratio: number): RGB {
  // Checked on whole channels, as the colour will be written (#rrggbb): rounding
  // can lighten a colour just past the threshold back under it.
  let out = whole(c);
  if (contrast(muted(out), out) >= ratio) return out;
  const [L, C, h] = toOklch(c);
  for (let l = L; l > 0 && contrast(muted(out), out) < ratio; l -= 0.01)
    out = whole(fromOklch([l, C, h]));
  return out;
}

/**
 * `legibleUnderText` for what moves with the clock: the lightest colour of the same hue and chroma that
 * keeps the ratio, found by bisection and drawn to the gamut's edge, instead of 0.01 steps of lightness each
 * through the stepped gamut reduction. Those steps made the sky jump between levels as the light crept
 * past the threshold (a channel by 10 or more in 7 minutes, WTH-046K). The live page keeps the stepped one.
 */
function legibleUnderTextEdge(c: RGB, ratio: number): RGB {
  const out = whole(c);
  if (contrast(muted(out), out) >= ratio) return out;
  const [L, C, h] = toOklch(c);
  const ok = (l: number) => {
    const r = whole(fromOklchEdge([l, C, h]));
    return contrast(muted(r), r) >= ratio;
  };
  let [lo, hi] = [0, L];
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) lo = mid;
    else hi = mid;
  }
  // Nothing met the ratio (not even the darkest): the stepped protection's own answer, rather than near black unchecked
  return ok(lo) ? whole(fromOklchEdge([lo, C, h])) : legibleUnderText(c, ratio);
}

/* ---------- 1. Natural solar light through the day ---------- */

/**
 * Keyed on the light scale from frames.ts: −1 night … 0 sunrise … 1 sunset … 2 night.
 * Soft pastel light over deep, quiet skies: ink-blue nights with a
 * periwinkle glow, rose and apricot dawns, a clean cerulean day under a
 * butter light, dusty rose and coral sunsets. Hues move gently from one
 * stop to the next. These are the existing artistic anchors, not weather
 * presets. skyPalette applies weather, UV and text protection afterwards.
 */
const SOLAR_STOPS: { at: number; sky: [string, string, string]; glow: RGBA }[] = [
  {
    at: -1,
    sky: ["#0c1026", "#171c42", "#29305f"],
    glow: [191, 203, 254, 0.18],
  },
  {
    at: -0.4,
    sky: ["#151a47", "#332f6e", "#6c5a98"],
    glow: [211, 190, 250, 0.24],
  },
  { at: 0, sky: ["#262d6a", "#8a5f9c", "#eba68f"], glow: [254, 200, 156, 0.5] },
  {
    at: 0.07,
    sky: ["#2c4f98", "#8b8fcc", "#f2c4a8"],
    glow: [254, 214, 170, 0.48],
  },
  {
    at: 0.2,
    sky: ["#2a67ae", "#6ba6d6", "#b4dde8"],
    glow: [249, 232, 167, 0.38],
  },
  {
    at: 0.45,
    sky: ["#1c60b6", "#3f92d0", "#a2d7ec"],
    glow: [249, 232, 167, 0.48],
  },
  {
    at: 0.72,
    sky: ["#2a59a6", "#6a8ecc", "#c2ccf2"],
    glow: [252, 224, 170, 0.44],
  },
  {
    at: 0.9,
    sky: ["#34478e", "#a07eb8", "#f2b598"],
    glow: [254, 200, 156, 0.5],
  },
  {
    at: 1,
    sky: ["#2f2765", "#a35784", "#ee9282"],
    glow: [254, 184, 193, 0.52],
  },
  {
    at: 1.4,
    sky: ["#141738", "#2d2760", "#5b407e"],
    glow: [211, 190, 250, 0.2],
  },
  {
    at: 2,
    sky: ["#0c1026", "#171c42", "#29305f"],
    glow: [191, 203, 254, 0.18],
  },
];

/**
 * Existing solar progression, independent of atmospheric measurements.
 * `light` is a finite Frame.light phase (-1 night, 0 sunrise, 1 sunset,
 * 2 night), not AtmosphereState.daylight brightness (0..1). Out-of-range
 * finite phases clamp to the night endpoints. Polar fallbacks live in frames.ts.
 * Returns fresh channel arrays; consumers transform them before rendering.
 */
export function solarPalette(light: number): SolarPalette {
  const u = Math.min(2, Math.max(-1, light));
  const j = Math.max(
    1,
    SOLAR_STOPS.findIndex((k) => k.at >= u),
  );
  const a = SOLAR_STOPS[j - 1];
  const b = SOLAR_STOPS[j];
  const t = (u - a.at) / (b.at - a.at || 1);
  return {
    sky: [0, 1, 2].map((i) => mix(hex(a.sky[i]), hex(b.sky[i]), t)) as [
      RGB,
      RGB,
      RGB,
    ],
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

/* ---------- 3. The strength of the sun ---------- */

/** The UV index at which the sky is as vivid as it can get. */
const UV_FULL = 8;
/** How vivid the colours are (their chroma, against the table's) under no UV at all, and at full strength. */
const VIVID_MIN = 0.6;
const VIVID_MAX = 1.3;
/** The same for the glow around the sun. */
const GLOW_MIN = 0.7;
const GLOW_MAX = 1.3;

/**
 * How much the UV index has a say, 0..1: all of it while the sun is up, none
 * at dawn, dusk and night, when it is zero whatever the day was like (a
 * sunset keeps its colours).
 */
const daylight = (light: number) =>
  light <= 0 || light >= 1 ? 0 : clamp01(2 * Math.sin(light * Math.PI));

/** The factor for a UV index between `min` (none) and `max` (full strength), eased in by the daylight. */
function sunStrength(
  uv: number,
  light: number,
  min: number,
  max: number,
): number {
  return 1 + (min + (max - min) * clamp01(uv / UV_FULL) - 1) * daylight(light);
}

/** The same colour, more or less vivid: chroma scaled in OKLCH, lightness and hue kept. */
function vivid(c: RGB, k: number): RGB {
  // Untouched when there is nothing to change: the round trip alone can move a channel by one.
  if (k === 1) return c;
  const [L, C, h] = toOklch(c);
  return fromOklch([L, C * k, h]);
}

/* ---------- 4. The map behind the page ---------- */

/**
 * The city's lines in the colours opposite the sky, like a screen print: the
 * roads that carry the drawing take the complementary hue and a neighbour
 * of it (on the side of butter, the page's accent), the streets a pale tint
 * of the sky's own hue, so there's a hierarchy and not a rainbow. Water is
 * the sky in shadow, or pale aqua where the sky is already too deep for a
 * shadow to show. A blue day gets apricot and butter roads, a rose sunset
 * sage and lime, a violet night butter and apricot. Each layer's opacity then rises until it clears a set contrast
 * against the sky, so the map carries the same weight at every hour instead
 * of vanishing by day.
 */
/** Layers whose tone is their point: never lightened to reach their contrast with the sky (see mapInks). */
const KEEP_TONE: ReadonlySet<MapLayer> = new Set([
  "traffic-slow",
  "traffic-heavy",
  "traffic-jam",
]);

const MAP_INK: Record<MapLayer, { contrast: number; minOpacity: number }> = {
  water: { contrast: 1.25, minOpacity: 0.5 },
  waterway: { contrast: 1.25, minOpacity: 0.6 },
  streets: { contrast: 1.5, minOpacity: 0.35 },
  "main-roads": { contrast: 1.9, minOpacity: 0.5 },
  motorways: { contrast: 2.2, minOpacity: 0.6 },
  // The optional layers: quiet ground (green, relief, contours, buildings) under the roads' weight,
  // and the things that move or glow (traffic, lights) as strong as the motorways.
  green: { contrast: 1.2, minOpacity: 0.3 },
  relief: { contrast: 1.25, minOpacity: 0.35 },
  contours: { contrast: 1.3, minOpacity: 0.4 },
  // The ways of getting about: lines as strong as the main roads' neighbours, the stops as the lights
  train: { contrast: 1.5, minOpacity: 0.4 },
  "train-stops": { contrast: 1.8, minOpacity: 0.7 },
  metro: { contrast: 1.5, minOpacity: 0.4 },
  "metro-stops": { contrast: 1.8, minOpacity: 0.7 },
  tram: { contrast: 1.5, minOpacity: 0.4 },
  "tram-stops": { contrast: 1.8, minOpacity: 0.7 },
  "bus-stops": { contrast: 1.7, minOpacity: 0.6 },
  buildings: { contrast: 1.25, minOpacity: 0.3 },
  // Volumes, not outlines: stronger, and opaque enough that the roads do not show through them
  "buildings-3d": { contrast: 1.4, minOpacity: 0.75 },
  shadows: { contrast: 1.25, minOpacity: 0.4 },
  "traffic-slow": { contrast: 2, minOpacity: 0.9 },
  "traffic-heavy": { contrast: 2.1, minOpacity: 0.95 },
  "traffic-jam": { contrast: 2.2, minOpacity: 1 },
  lights: { contrast: 2, minOpacity: 0.7 },
};
/**
 * How much of each layer's opacity, and so of its contrast with the sky, the thickest haze takes (WTH-046F): the ground
 * (meadows, relief, contours, shadows) fades most, the middle (water, streets, flat buildings) softens, and
 * what the map is read by (the main roads, the ways of getting about, traffic, lights) holds. Faded layers
 * draw towards the sky and so towards one another: their separation shrinks with them (see the engine doc).
 */
const DEPTH_FAR = 0.75;
const DEPTH_MID = 0.35;
const DEPTH_PLANE: Record<MapLayer, number> = {
  green: DEPTH_FAR,
  relief: DEPTH_FAR,
  contours: DEPTH_FAR,
  shadows: DEPTH_FAR,
  water: DEPTH_MID,
  waterway: DEPTH_MID,
  streets: DEPTH_MID,
  buildings: DEPTH_MID,
  // Volumes stay as opaque as MAP_INK makes them, or the roads would show through them in fog
  "buildings-3d": 0,
  "main-roads": 0,
  motorways: 0,
  train: 0,
  "train-stops": 0,
  metro: 0,
  "metro-stops": 0,
  tram: 0,
  "tram-stops": 0,
  "bus-stops": 0,
  "traffic-slow": 0,
  "traffic-heavy": 0,
  "traffic-jam": 0,
  lights: 0,
};
/**
 * The share of each line that shows through the backdrop's fade (65% away from the city, see
 * .backdrop-fade), taken lower on purpose: the contrast holds under the reading's veil too.
 */
const MAP_FADE = 0.5;
/**
 * How far apart, in OKLab (see `colorDistance`), the colours of the water, the roads and the buildings are
 * kept as they show over the sky: plainly different, so no one is taken for another whatever the hue,
 * the intensity or the sky.
 */
export const MAP_SEPARATION = 0.1;
/** Below this chroma the sky reads as grey; it counts as a cool grey, so its lines turn warm. */
const GREY_SKY = 0.035;
const deg = (d: number) => (d * Math.PI) / 180;
const COOL_HUE = deg(255);
/** Butter, the accent: the main roads lean from the complementary hue towards it */
const BUTTER_HUE = deg(95);
/** Water where the sky is too deep for a shadow of it to read */
const AQUA: LCH = [0.86, 0.075, deg(220)];

function skyHue(sky: RGB): number {
  const [, C, h] = toOklch(sky);
  return C < GREY_SKY ? COOL_HUE : h;
}

/** How the viewer may tune the lines, each 0..100 but the hue (degrees); see map-tuning.ts. 50 is the page's own. */
export interface MapTune {
  hue: number;
  vivid: number;
  contrast: number;
}
const UNTUNED: MapTune = { hue: 0, vivid: 50, contrast: 50 };

/** The most the chroma is multiplied by, and how much lightness a line gives up to carry it (a pale colour can't be vivid). */
const VIVID_TOP = 2.4;
const VIVID_DEEPENS = 0.16;
/** How far the contrast each layer must reach (its distance from none, 1) is scaled: faint, the page's own, strong. */
const CONTRAST_SOFT = 0.35;
const CONTRAST_STRONG = 2;
/** A line may be lightened this far to reach its contrast once fully opaque. */
const LIGHTEST = 0.96;

/** The chroma multiplier and the lightness given up at a `vivid` setting (0..100). */
function vividness(vivid: number): { chroma: number; deepen: number } {
  if (vivid <= 50) return { chroma: vivid / 50, deepen: 0 };
  const t = (vivid - 50) / 50;
  return { chroma: 1 + (VIVID_TOP - 1) * t, deepen: VIVID_DEEPENS * t };
}

/** The lightness and chroma of the map's main lines at a `vivid` setting, for drawing the controls' tracks. */
export function mapTone(vivid: number): { lightness: number; chroma: number } {
  const v = vividness(vivid);
  return { lightness: 0.9 - v.deepen, chroma: 0.1 * v.chroma };
}

/** How many variants of a layer's colour are tried at most to keep it apart from the others */
const MAX_TRIES = 14;

/** The ranks of road, which carry the drawing and the viewer's hue: never moved to make room for another layer */
const ROADS: readonly MapLayer[] = ["streets", "main-roads", "motorways"];

/**
 * The layers that are kept apart from one another when shown together, each group of layers drawn in one
 * colour (a line and its stops), in the order they are placed: the first to give way is the last in the list.
 */
const GROUPS: readonly (readonly MapLayer[])[] = [
  ["water", "waterway"],
  ["buildings", "buildings-3d"],
  ["train", "train-stops"],
  ["metro", "metro-stops"],
  ["tram", "tram-stops"],
  ["bus-stops"],
  ["green"],
];

/** The city as the page always draws it: the layers kept apart unless the viewer chose others (see `mapInksFor`) */
const CITY_LAYERS: ReadonlySet<MapLayer> = new Set<MapLayer>([
  "water",
  "waterway",
  "streets",
  "main-roads",
  "motorways",
]);

/** Every layer there is, for keeping them all apart */
export const ALL_MAP_LAYERS: ReadonlySet<MapLayer> = new Set(
  Object.keys(MAP_INK) as MapLayer[],
);

/**
 * `tune` moves all the lines together from the colours described above: the
 * hue turns them round the wheel, `vivid` scales their chroma (deepening them
 * to make room for it), `contrast` scales how far from the sky each must
 * stand. A line too deep to read once fully opaque is lightened until it does.
 * `air` (see `MapVisualState`) is the weather: its chroma and the lightness
 * of the land and the water enter the colours before they are kept apart (so
 * the separation holds in snow and rain too), and the map's hierarchy is
 * reweighed last (rain firms the water, snow restrains the infrastructure, a
 * storm compresses the background and sharpens the roads), with haze closing
 * the distance: each layer gives up its plane's share of opacity, so the far
 * ground fades, the middle softens and the foreground holds.
 */
function mapInks(
  sky: RGB,
  tune: MapTune = UNTUNED,
  active: ReadonlySet<MapLayer> = CITY_LAYERS,
  air: MapVisualState = CLEAR_MAP,
): Record<MapLayer, MapInk> {
  const [L, C] = toOklch(sky);
  const hue = skyHue(sky);
  const opposite = hue + Math.PI;
  const turn = deg(tune.hue);
  const v = vividness(tune.vivid);
  const k =
    tune.contrast <= 50
      ? CONTRAST_SOFT + (1 - CONTRAST_SOFT) * (tune.contrast / 50)
      : 1 + (CONTRAST_STRONG - 1) * ((tune.contrast - 50) / 50);
  // When the opposite already is butter (a violet night), the neighbour goes warm, to apricot.
  const lean = Math.sin(BUTTER_HUE - opposite);
  const towardButter =
    Math.abs(lean) < Math.sin(deg(25)) ? -1 : Math.sign(lean);
  const shadow: LCH = [L * 0.62, Math.min(C, 0.08) * v.chroma, hue + turn];
  const water: LCH =
    contrast(
      mix(
        sky,
        whole(fromOklch([shadow[0], Math.min(C, 0.08), hue])),
        0.8 * MAP_FADE,
      ),
      sky,
    ) >= MAP_INK.water.contrast
      ? shadow
      : [AQUA[0], AQUA[1] * v.chroma, AQUA[2] + turn];
  const road = (l: number, c: number, h: number): LCH => [
    l - v.deepen,
    c * v.chroma,
    h + turn,
  ];
  /** The hues of the three ranks of road: streets, main roads, motorways */
  const roadHues = [hue, opposite + towardButter * deg(35), opposite];
  const colors: Record<MapLayer, LCH> = {
    water,
    waterway: water,
    streets: road(0.92, 0.045, hue),
    "main-roads": road(0.87, 0.1, opposite + towardButter * deg(35)),
    motorways: road(0.94, 0.1, opposite),
    // Meadows on the far side of the wheel from the main roads, so green never fights them
    green: road(0.82, 0.07, opposite - towardButter * deg(70)),
    relief: road(0.9, 0.03, hue),
    // The contours are coloured by height: the ramp's first colour, the rest worked out from it below
    contours: road(0.8, 0.09, opposite - deg(60)),
    // Each way of getting about its own hue round the wheel, a stop in the colour of its line
    train: road(0.9, 0.06, opposite - towardButter * deg(35)),
    "train-stops": road(0.9, 0.06, opposite - towardButter * deg(35)),
    metro: road(0.84, 0.1, opposite + towardButter * deg(100)),
    "metro-stops": road(0.84, 0.1, opposite + towardButter * deg(100)),
    tram: road(0.88, 0.1, opposite - towardButter * deg(110)),
    "tram-stops": road(0.88, 0.1, opposite - towardButter * deg(110)),
    "bus-stops": road(0.8, 0.09, opposite + towardButter * deg(160)),
    buildings: road(0.9, 0.03, hue),
    "buildings-3d": road(0.9, 0.03, hue),
    // A shadow is the sky darker, like the water
    shadows: shadow,
    // Traffic is drawn in the complement of the road it is on (see its ramp below), strong: darker and more
    // vivid than the pale roads, and the slower it is the more of both. It keeps its tone rather than being
    // lightened to stand out from the sky: it is the road's contrast it must have.
    "traffic-slow": road(
      0.74,
      0.17,
      opposite + towardButter * deg(35) + Math.PI,
    ),
    "traffic-heavy": road(
      0.66,
      0.2,
      opposite + towardButter * deg(35) + Math.PI,
    ),
    "traffic-jam": road(
      0.58,
      0.23,
      opposite + towardButter * deg(35) + Math.PI,
    ),
    lights: road(0.95, 0.09, BUTTER_HUE),
  };
  // The weather's say on colour, before the layers are drawn and kept apart from one another
  if (!isClearMap(air))
    for (const layer of Object.keys(colors) as MapLayer[]) {
      const plane = MAP_PLANE[layer];
      const [l, c, h] = colors[layer];
      // Snow brightens the ground; the buildings, already pale, step the other way so they stand against it
      // (lifted too they would meet the ground and the streets)
      const lift = plane === "terrain" ? air.landLift : plane === "building" ? -0.6 * air.landLift : plane === "water" ? -air.waterDeepen : 0;
      colors[layer] = [Math.min(LIGHTEST, Math.max(0.05, l + lift)), c * (plane === "tone" ? 1 : air.saturation), h];
    }
  /**
   * A layer drawn in one colour (`l`, `c`, `h`): as opaque as it takes to stand out from the sky as it must,
   * whatever the tuning (see the contrast above); `ok` says whether it does. `firmer` starts it more opaque
   * than it needs to be, to stand further from the sky and from the layers beside it.
   */
  const attempt = (
    layer: MapLayer,
    l: number,
    c: number,
    h: number,
    firmer: number,
  ) => {
    const base = MAP_INK[layer];
    const target = 1 + (base.contrast - 1) * k;
    // What a line must reach whatever the tuning: the viewer's softer contrast when they asked for one, the page's own otherwise.
    const floor = Math.min(target, base.contrast);
    const ink = whole(fromOklch([l, c, h]));
    const seen = (opacity: number) =>
      contrast(mix(sky, ink, opacity * MAP_FADE), sky);
    // The least opacity that reaches the target, to the nearest 0.02: the contrast only grows with it,
    // so it is bisected rather than stepped up to.
    let opacity = Math.min(1, base.minOpacity * k * firmer);
    if (opacity < 1 && seen(opacity) < target) {
      let lo = opacity;
      let hi = 1;
      while (hi - lo > 0.02) {
        const mid = (lo + hi) / 2;
        if (seen(mid) >= target) hi = mid;
        else lo = mid;
      }
      // Written to two decimals: round up, never down past the target
      opacity = Math.min(1, Math.ceil(hi * 100) / 100);
    }
    // Water is the sky in shadow: darker than it, so lightening would only lose it.
    const ok = seen(opacity) >= floor || l < L || KEEP_TONE.has(layer);
    return { ink, opacity, ok, l, c, h };
  };

  /** What a drawn layer is as a map ink: its colour and opacity, and the colours it carries by value (a ramp) */
  const finish = (
    layer: MapLayer,
    { ink, opacity, l, c, h }: ReturnType<typeof attempt>,
  ): MapInk => {
    const result: MapInk = { color: toHex(ink), opacity: +opacity.toFixed(2) };
    if (layer === "contours") {
      // Lowland to peak: the hue turns, the colour thins and lightens, so the heights read as a gradient
      result.ramp = Array.from({ length: ELEVATION_STEPS }, (_, i) => {
        const t = i / (ELEVATION_STEPS - 1);
        return toHex(
          whole(
            fromOklch([
              Math.min(LIGHTEST, l + t * 0.12),
              c * (1 - 0.5 * t),
              h + deg(ELEVATION_SWEEP * t),
            ]),
          ),
        );
      });
    }
    if (layer.startsWith("traffic")) {
      // One colour per road it can be on, each the complement of that road's own (streets, main roads, motorways)
      result.ramp = roadHues.map((rh) =>
        toHex(whole(fromOklch([l, c, rh + Math.PI + turn]))),
      );
    }
    return result;
  };

  /** A layer drawn from a base colour, lightened as far as it takes to stand out from the sky as it must */
  const settle = (layer: MapLayer, from: LCH): MapInk => {
    const [, c, h] = from;
    for (let l = from[0]; ; l += 0.02) {
      const drawn = attempt(layer, l, c, h, 1);
      if (drawn.ok || l >= LIGHTEST) return finish(layer, drawn);
    }
  };

  const inks = Object.fromEntries(
    (Object.keys(MAP_INK) as MapLayer[]).map((layer) => [
      layer,
      settle(layer, colors[layer]),
    ]),
  ) as Record<MapLayer, MapInk>;

  // The colour a layer shows over the sky, which is what the eye compares
  const shown = (ink: MapInk) => mix(sky, hex(ink.color), ink.opacity);
  const gapFrom = (ink: MapInk, others: readonly MapLayer[]) =>
    Math.min(...others.map((o) => oklabDistance(shown(ink), shown(inks[o]))));

  /**
   * Keeps a group of layers (the water, the buildings, a way of getting about) clear of the ones already
   * placed: if the colour it came out in is closer than MAP_SEPARATION (less if the viewer asked for a
   * fainter map) to any of theirs, it is looked for again among variants of itself, the nearest to the
   * intended colour first (the same hue a little darker or lighter, more opaque, then a turn of the
   * hue, then both), and the first that clears the gap is taken. If none does, the one that comes
   * nearest to it is.
   */
  const keepApart = (
    group: readonly MapLayer[],
    among: readonly MapLayer[],
  ) => {
    const wanted = MAP_SEPARATION * Math.min(1, k);
    /** The group's layers drawn from one base, or null if one does not stand out from the sky as it must; its gap is its worst layer's */
    const draw = (from: LCH, firmer: number) => {
      const drawn: Record<string, MapInk> = {};
      for (const layer of group) {
        const one = attempt(layer, from[0], from[1], from[2], firmer);
        if (!one.ok) return null;
        drawn[layer] = finish(layer, one);
      }
      return {
        drawn,
        gap: Math.min(...group.map((layer) => gapFrom(drawn[layer], among))),
      };
    };
    const [l0, c0, h0] = colors[group[0]];
    // The colour it came out in, as it stands
    let best = {
      drawn: Object.fromEntries(
        group.map((layer) => [layer, inks[layer]]),
      ) as Record<string, MapInk>,
      gap: Math.min(...group.map((layer) => gapFrom(inks[layer], among))),
    };
    if (best.gap >= wanted) return;
    const variants: { from: LCH; firmer: number; cost: number }[] = [];
    for (const turnBy of [0, 90, -90, 180]) {
      for (const dl of [0, -0.12, -0.24, -0.34, 0.06]) {
        for (const firmer of [1, 1.8]) {
          const l = l0 + dl;
          if (l < 0.3 || l > LIGHTEST) continue;
          variants.push({
            from: [l, c0 * 1.6, h0 + deg(turnBy)],
            firmer,
            cost:
              Math.abs(turnBy) / 180 + Math.abs(dl) * 2.5 + (firmer - 1) * 0.3,
          });
        }
      }
    }
    variants.sort((a, b) => a.cost - b.cost);
    // At most this many that stand out from the sky are looked at: a group that cannot be kept apart takes
    // the best of them, so the colours of a busy map are worked out in a few milliseconds, not in a search
    // of everything
    let tries = 0;
    for (const { from, firmer } of variants) {
      const tried = draw(from, firmer);
      if (!tried) continue;
      if (tried.gap > best.gap) best = tried;
      if (tried.gap >= wanted || ++tries >= MAX_TRIES) break;
    }
    Object.assign(inks, best.drawn);
  };

  // The roads carry the drawing and the viewer's hue, so they stay as they are. Each group after them, in
  // order of weight, gives way to everything placed before it, and only the layers on show count: there is
  // no use keeping apart what the viewer cannot see.
  const placed = ROADS.filter((layer) => active.has(layer));
  for (const group of GROUPS) {
    if (!group.some((layer) => active.has(layer))) continue;
    keepApart(group, placed);
    placed.push(...group);
  }
  // The weights and the depth last: the colours stay as drawn and kept apart, only each layer's opacity moves
  if (!isClearMap(air))
    for (const layer of Object.keys(inks) as MapLayer[])
      inks[layer] = weathered(inks[layer], layer, air);
  return inks;
}

/**
 * What the weather does to the map's hierarchy (WTH-046G), the map half of the atmosphere: weights on the
 * planes (1 leaves a plane as it is), the chroma of every line, how far the land and the water move in
 * lightness, and the air's depth (WTH-046F). All of it is 1, or 0, in clear air.
 */
export interface MapVisualState {
  /** 1 clear air, 0 the thickest haze: see `atmosphereDepth` */
  depth: number;
  /** Opacity weights of the planes */
  waterWeight: number;
  roadWeight: number;
  buildingWeight: number;
  terrainWeight: number;
  /** Chroma multiplier of every line but the traffic's and the lights' own tones */
  saturation: number;
  /** Lightness the ground gains, as snow brightens it; and the water loses, as rain deepens it */
  landLift: number;
  waterDeepen: number;
}

export const CLEAR_MAP: MapVisualState = {
  depth: 1,
  waterWeight: 1,
  roadWeight: 1,
  buildingWeight: 1,
  terrainWeight: 1,
  saturation: 1,
  landLift: 0,
  waterDeepen: 0,
};

const isClearMap = (s: MapVisualState) =>
  (Object.keys(CLEAR_MAP) as (keyof MapVisualState)[]).every((k) => s[k] === CLEAR_MAP[k]);

/** The planes of the map's hierarchy: what each layer's weight is */
type MapPlane = "water" | "road" | "building" | "terrain" | "tone";
const MAP_PLANE: Record<MapLayer, MapPlane> = {
  water: "water",
  waterway: "water",
  // The streets are a pale tint of the sky, the ground of the drawing: weather weighs on the roads above them
  streets: "tone",
  "main-roads": "road",
  motorways: "road",
  train: "road",
  "train-stops": "road",
  metro: "road",
  "metro-stops": "road",
  tram: "road",
  "tram-stops": "road",
  "bus-stops": "road",
  buildings: "building",
  // Volumes stay as opaque as MAP_INK makes them (see DEPTH_PLANE): weather weighs on the flat buildings
  "buildings-3d": "tone",
  green: "terrain",
  relief: "terrain",
  contours: "terrain",
  shadows: "terrain",
  // Traffic and lights keep their own tone and weight: they are information, not weather
  "traffic-slow": "tone",
  "traffic-heavy": "tone",
  "traffic-jam": "tone",
  lights: "tone",
};

/** The share of its opacity a layer keeps in this air: its plane's weight, and the depth's share of its plane. 1 in clear air. */
function opacityFactor(layer: MapLayer, air: MapVisualState): number {
  const weight = {
    water: air.waterWeight,
    road: air.roadWeight,
    building: air.buildingWeight,
    terrain: air.terrainWeight,
    tone: 1,
  }[MAP_PLANE[layer]];
  return weight * (1 - (1 - air.depth) * DEPTH_PLANE[layer]);
}

/** One ink in this air: its opacity as the factor leaves it (the colour was settled before, see `mapInks`). */
function weathered(ink: MapInk, layer: MapLayer, air: MapVisualState): MapInk {
  return { ...ink, opacity: +clamp01(ink.opacity * opacityFactor(layer, air)).toFixed(2) };
}

/**
 * The map's lines over a sky (a palette's `sky2`) as the viewer tuned them
 * (see MapControls): their hue, how vivid, how strong against the sky. The layers in
 * `active` (the city's own unless said otherwise) are kept apart from one another in colour.
 * `air` is the weather's (see `mapVisualState`); the live page has none yet, so clear air.
 */
export function mapInksFor(
  sky: string,
  tune: MapTune,
  active: ReadonlySet<MapLayer> = CITY_LAYERS,
  air: MapVisualState = CLEAR_MAP,
): Record<MapLayer, MapInk> {
  // Worked out once per sky, tuning and choice of layers: scrubbing the timeline asks again and again for the same few
  const key = `${sky}|${tune.hue}|${tune.vivid}|${tune.contrast}|${[...active].sort().join(",")}|${Object.values(air).join(",")}`;
  const known = inksMemo.get(key);
  if (known) return known;
  const inks = mapInks(hex(sky), tune, active, air);
  if (inksMemo.size >= INKS_MEMO)
    inksMemo.delete(inksMemo.keys().next().value as string);
  inksMemo.set(key, inks);
  return inks;
}
const INKS_MEMO = 96;
const inksMemo = new Map<string, Record<MapLayer, MapInk>>();

/**
 * A line's colour as it shows over a sky: its ink at its opacity. What a
 * colour chip must show for the lines to be recognised in it, since how
 * strongly a line stands out is set by its opacity alone.
 */
export function inkOverSky(sky: string, ink: MapInk): string {
  return toHex(mix(hex(sky), hex(ink.color), ink.opacity));
}

/** The hue, in degrees, of the map's main lines over a sky before any turn: where the viewer's hue slider starts from. */
export function motorwayHue(sky: string): number {
  return ((skyHue(hex(sky)) + Math.PI) * 180) / Math.PI;
}

/* ---------- 5. Palette ---------- */

/** The live page's sky inputs: the categorical weather state over the light. */
export interface StateSkyInput {
  light: number;
  state: WeatherState;
  cloudCover: number;
  /** The UV index; without it (not every provider has one) the colours are the table's own */
  uv?: number;
}

/**
 * Steps 2 and 3 as the live page applies them: the state's grey and dim, then the UV's vividness.
 * Exported so the atmosphere transform (section 6) can be calibrated against it.
 */
export function stateSky({ light, state, cloudCover, uv }: StateSkyInput): SolarPalette {
  const { sky, glow: tableGlow } = solarPalette(light);
  const glow: RGBA =
    uv == null
      ? tableGlow
      : [
          tableGlow[0],
          tableGlow[1],
          tableGlow[2],
          tableGlow[3] * sunStrength(uv, light, GLOW_MIN, GLOW_MAX),
        ];
  const w = WEATHER[state];
  // Cloud cover greys even a nominally clear or partly cloudy sky a little.
  const grey = clamp01(Math.max(w.grey, (cloudCover / 100) * 0.35));
  const dulled = sky.map((c) =>
    scale(mix(c, overcast(c, state === "SNOW"), grey), w.dim),
  ) as [RGB, RGB, RGB];
  const weathered =
    uv == null
      ? dulled
      : (dulled.map((c) =>
          vivid(c, sunStrength(uv, light, VIVID_MIN, VIVID_MAX)),
        ) as [RGB, RGB, RGB]);
  return { sky: weathered, glow };
}

/** Below the sunrise's blue hour or past the sunset's: the markers turn to moonlight and the clouds thin. */
const isDark = (light: number) => light < -0.3 || light > 1.3;
/** The clouds' tint when they carry rain: a cool slate rather than white */
const RAIN_CLOUD: RGB = [205, 214, 226];

export function skyPalette(input: StateSkyInput): SkyPalette {
  const { sky, glow } = stateSky(input);
  const rainy = input.state === "RAIN" || input.state === "HEAVY_RAIN" || input.state === "STORM";
  const dark = isDark(input.light);
  const cloud: RGBA = rainy ? [...RAIN_CLOUD, dark ? 0.07 : 0.2] : [...WHITE, dark ? 0.06 : 0.2];
  return finishPalette(sky, glow, input.light, cloud);
}

/**
 * Text sits on every part of the sky: the reading at the top, and — as the
 * page scrolls over the fixed sky — chapter titles and the footer on the
 * horizon. All of it stays at AA; the glow still brightens the light source.
 */
function legibleSky(weathered: [RGB, RGB, RGB], continuous = false): [RGB, RGB, RGB] {
  const protect = continuous ? legibleUnderTextEdge : legibleUnderText;
  return [protect(weathered[0], 4.8), protect(weathered[1], 4.6), protect(weathered[2], 4.5)];
}

/** The three sky stops and the glow as the page would paint them, without glass or map: cheap enough for a whole day of strips. */
export function skyColors({ sky, glow }: SolarPalette, continuous = false): {
  sky1: string;
  sky2: string;
  sky3: string;
  glow: string;
} {
  const [sky1, sky2, sky3] = legibleSky(sky, continuous).map(toHex);
  return { sky1, sky2, sky3, glow: rgba(glow) };
}

/** Step 4 and 5, shared by every way of weathering the sky: text protection, glass, the markers and the map. */
function finishPalette(
  weathered: [RGB, RGB, RGB],
  glow: RGBA,
  light: number,
  cloud: RGBA,
  map: MapVisualState = CLEAR_MAP,
  continuous = false,
): SkyPalette {
  const [sky1, sky2, sky3] = legibleSky(weathered, continuous);

  // Glass: the thinnest veil over the brightest part of the sky that keeps muted text at AA.
  // The veil is the top of the sky, deepened, so fields and buttons stay in its hue.
  const veil = whole(
    fromOklch([0.16, Math.min(0.05, toOklch(sky1)[1]), toOklch(sky1)[2]]),
  );
  // Starts at a clearly frosted panel (the cards read as solid surfaces), thicker where the sky needs it.
  let alpha = 0.34;
  while (
    alpha < 0.7 &&
    contrast(muted(mix(sky3, veil, alpha)), mix(sky3, veil, alpha)) < 4.6
  )
    alpha += 0.02;
  const dark = isDark(light);

  return {
    sky1: toHex(sky1),
    sky2: toHex(sky2),
    sky3: toHex(sky3),
    glass: rgba([...veil, alpha]),
    glow: rgba(glow),
    // The "now" markers: the glow's own colour by day, a periwinkle moonlight at night.
    sun: dark ? "#bfcbfe" : toHex([glow[0], glow[1], glow[2]]),
    cloud: rgba(cloud),
    map: mapInks(sky2, UNTUNED, CITY_LAYERS, map),
  };
}

/* ---------- 6. The atmosphere over the light (WTH-046E) ---------- */

/*
 * The continuous successor of section 2: each atmosphere axis transforms the
 * solar base in OKLCH, with a bounded influence and in a fixed order, instead
 * of a weather state choosing a grey and a dim. Not yet on the live page: it
 * is calibrated against `stateSky` first (WTH-046K). The table of ranges,
 * curves and limits is in docs/WEATHER_VISUAL_ENGINE.md (WTH-046E).
 */

/** Temperature sets the white balance: warm air leans every colour towards amber, cool air towards cyan by day and a deeper blue by night. */
const WARM_POLE = deg(50);
const COOL_POLE_DAY = deg(200);
const COOL_POLE_NIGHT = deg(255);
/** Rain turns the sky towards slate, snow towards a cold blue, a storm towards indigo. */
const WET_POLE = deg(240);
const SNOW_POLE = deg(225);
const STORM_POLE = deg(270);
/** No rotation of a sky hue passes through green: it goes the other way round the wheel. */
const GREEN = deg(140);

/** Each axis's most influence, reached only at the axis's full value. */
export const ATMOSPHERE_LIMITS = {
  /** The white balance's shift in OKLab (a, b) at warmth ±1: a tint, never a theme */
  warmthShift: 0.022,
  /** Hue rotations in degrees, and the most they may add up to on any stop */
  wetTurn: 8,
  snowTurn: 10,
  stormTurn: 8,
  totalTurn: 20,
  /** Chroma taken away at the axis's full value */
  cloudChroma: 0.72,
  hazeChroma: 0.5,
  wetChroma: 0.4,
  snowChroma: 0.55,
  stormChroma: 0.35,
  /** No stop ends with less than this share of its base chroma (an overcast sunset keeps a trace of it) */
  chromaFloor: 0.18,
  /** Lightness taken away at the axis's full value, and what snow gives back towards white */
  cloudDim: 0.08,
  wetDim: 0.3,
  stormDim: 0.42,
  snowLift: 0.14,
  /** No stop ends darker than this share of its base lightness */
  dimFloor: 0.45,
  /** How far a storm deepens the top of the sky against the horizon, for a local hierarchy */
  stormTop: 0.14,
  /** The spread of lightness between the stops taken away at the axis's full value */
  cloudSpread: 0.5,
  wetSpread: 0.3,
  snowSpread: 0.35,
  /**
   * Haze below this has no say on depth; from it to full haze the veil eases in (smoothstep). Saturated
   * air alone (dew point and humidity, WTH-046B) gives 0.45 of haze: depth starts closing only once
   * visibility is lost on top of it.
   */
  hazeOnset: HAZE_ONSET,
  /**
   * The veil's lightness at most: just above where text protection caps any sky under white text
   * (about 0.5 in OKLCH), so the veil reaches that cap but rain and storm can still be seen to darken it.
   */
  veilLightest: 0.56,
  /** Snow mixes the veil in OKLab towards a cold blue (the snow's pole) of this chroma, all the way at full snow */
  snowVeilChroma: 0.05,
  /** How far each stop (top, middle, horizon) moves into the haze's veil at full haze: the farthest most */
  hazeVeil: [0.8, 0.65, 0.45] as const,
  /** Glow taken away at the axis's full value */
  cloudGlow: 0.55,
  hazeGlow: 0.45,
  wetGlow: 0.3,
  snowGlow: 0.3,
  stormGlow: 0.8,
  /** The share of the sun's glow the weather always leaves: a storm dims the light source, it does not remove it */
  glowFloor: 0.06,
  /** Glow chroma taken away in the coldest air: a whiter light */
  coldGlowChroma: 0.3,
  /** When several axes pull one property the same way, the strongest counts in full and the rest by this share */
  rest: 0.25,
} as const;

const mod = (x: number, m: number) => ((x % m) + m) % m;
const TAU = 2 * Math.PI;

/** Turn hue `h` towards `pole` by at most `most` radians, the way round that does not cross green. */
function turnToward(h: number, pole: number, most: number): number {
  if (most <= 0) return h;
  const forward = mod(pole - h, TAU);
  const viaGreen = mod(GREEN - h, TAU) < forward;
  const arc = viaGreen ? forward - TAU : forward;
  return h + Math.sign(arc) * Math.min(Math.abs(arc), most);
}

/** The signed difference between two hues, in -π..π. */
const hueDelta = (a: number, b: number) => mod(a - b + Math.PI, TAU) - Math.PI;

const toLab = ([L, C, h]: LCH): LCH => [L, C * Math.cos(h), C * Math.sin(h)];
const fromLab = ([L, A, B]: LCH): LCH => [L, Math.hypot(A, B), Math.atan2(B, A)];

/**
 * Several axes pulling one property the same way (each a share 0..1 taken
 * away): the strongest counts in full, the others by `rest` of theirs, so
 * a rainy, misty, overcast sky is greyer than any one of them alone but
 * the pulls do not multiply into the floor. Never more than 1.
 */
function combined(...pulls: number[]): number {
  const strongest = Math.max(0, ...pulls);
  const all = pulls.reduce((sum, p) => sum + Math.max(0, p), 0);
  return Math.min(1, strongest + ATMOSPHERE_LIMITS.rest * (all - strongest));
}

const smooth = (low: number, high: number, x: number) => {
  const t = clamp01((x - low) / (high - low));
  return t * t * (3 - 2 * t);
};

/** The white balance's shift in OKLab for an atmosphere: towards amber when warm, cyan (day) or deep blue (night) when cold. */
function whiteBalance(a: AtmosphereAxes): [number, number] {
  const pole = a.warmth >= 0 ? WARM_POLE : COOL_POLE_NIGHT + (COOL_POLE_DAY - COOL_POLE_NIGHT) * a.daylight;
  const k = ATMOSPHERE_LIMITS.warmthShift * Math.abs(a.warmth);
  return [k * Math.cos(pole), k * Math.sin(pole)];
}

/**
 * The solar base under an atmosphere. In order, each step reading the one before:
 *  1. hue: temperature shifts the white balance (a small offset in OKLab); rain,
 *     snow and storm each turn the hue a little, never through green and never
 *     more than `totalTurn` in all;
 *  2. chroma: the sun's strength (the UV, as on the live page) times what the
 *     weather leaves of it (`combined`);
 *  3. depth: past `hazeOnset`, haze draws the stops into one pale veil of the
 *     horizon's hue (snow cools it in OKLab), the top most, so the sky's depth
 *     closes in;
 *  4. lightness: clouds, rain and storm darken it (`combined`), snow lifts it
 *     towards white, a storm deepens the top;
 *  5. contrast: clouds, rain and snow draw the stops' lightness together;
 *  6. floors: whatever came before, each stop keeps at least `dimFloor` of
 *     its base lightness and `chromaFloor` of its base chroma;
 *  7. back to sRGB, giving up chroma (not hue) where a colour is out of gamut.
 * Text protection follows in `atmospherePalette`, as for every sky: it caps
 * how light any sky may be under white text, so a lighter atmosphere
 * (fog, snow) shows as one that reaches that cap and flattens there.
 */
export function atmosphereSky(light: number, a: AtmosphereAxes): SolarPalette {
  const base = solarPalette(light);
  const X = ATMOSPHERE_LIMITS;
  const [wa, wb] = whiteBalance(a);

  // The sun's strength in the shape of section 3's, read from the normalized axes: daylight eases it in,
  // energy (daylight times visual-input's UV curve, a smoothstep with a neutral value for missing UV)
  // carries it up. Not identical to the live page's linear UV and untouched missing UV (see the doc).
  const sun = (min: number, max: number) => 1 + (min - 1) * a.daylight + (max - min) * a.energy;
  // Haze has a say only past what saturated air alone gives, the same onset for depth, colour and glow:
  // a clear, humid noon with perfect visibility stays a clear noon.
  const haze = smooth(X.hazeOnset, 1, a.haze);
  const chroma =
    (1 -
      combined(
        X.cloudChroma * a.cloudiness,
        X.hazeChroma * haze,
        X.wetChroma * a.wetness,
        X.snowChroma * a.snow,
        X.stormChroma * a.severity,
      )) *
    sun(VIVID_MIN, VIVID_MAX);
  const dim = 1 - combined(X.cloudDim * a.cloudiness, X.wetDim * a.wetness, X.stormDim * a.severity);
  const spread = 1 - combined(X.cloudSpread * a.cloudiness, X.wetSpread * a.wetness, X.snowSpread * a.snow);

  const bases = base.sky.map(toOklch);
  // 1. Hue and 2. chroma
  const stops = base.sky.map((c): LCH => {
    const [L0, C0, h0] = toOklch(c);
    const [, C1, h1] = fromLab([L0, C0 * Math.cos(h0) + wa, C0 * Math.sin(h0) + wb]);
    let h = h1;
    h = turnToward(h, WET_POLE, deg(X.wetTurn) * a.wetness);
    h = turnToward(h, SNOW_POLE, deg(X.snowTurn) * a.snow);
    h = turnToward(h, STORM_POLE, deg(X.stormTurn) * a.severity);
    const turned = hueDelta(h, h1);
    if (Math.abs(turned) > deg(X.totalTurn)) h = h1 + Math.sign(turned) * deg(X.totalTurn);
    return [L0, C1 * chroma, h];
  });

  // 3. Depth: one veil, the horizon's hue, pale and nearly grey, a touch lighter than the lightest stop.
  // Fog is the horizon's own pale tone; snow mixes it, in OKLab and so the short way, towards a faint
  // cold blue white, which never reads as rain and never passes through magenta or green on the way.
  if (haze > 0) {
    const horizon = stops[2];
    const fog = toLab([0, Math.min(horizon[1], 0.03), horizon[2]]);
    const cold = toLab([0, X.snowVeilChroma, SNOW_POLE]);
    const veil: LCH = [
      Math.min(X.veilLightest, Math.max(...stops.map((s) => s[0])) + 0.04),
      fog[1] + (cold[1] - fog[1]) * a.snow,
      fog[2] + (cold[2] - fog[2]) * a.snow,
    ];
    stops.forEach((s, i) => {
      const [L, C, h] = fromLab(mix(toLab(s), veil, haze * X.hazeVeil[i]));
      s[0] = L;
      s[1] = C;
      // A stop with next to no chroma has no hue of its own: it takes the veil's
      s[2] = C < 1e-4 ? horizon[2] : h;
    });
  }

  // 4. Lightness
  stops.forEach((s, i) => {
    let L = s[0] * dim;
    L += X.snowLift * a.snow * (1 - L);
    if (i === 0) L *= 1 - X.stormTop * a.severity;
    s[0] = L;
  });

  // 5. Contrast between the stops
  const mean = (stops[0][0] + stops[1][0] + stops[2][0]) / 3;
  for (const s of stops) s[0] = mean + (s[0] - mean) * spread;

  // 6. Floors, on the result of every step before
  stops.forEach((s, i) => {
    s[0] = Math.max(s[0], X.dimFloor * bases[i][0]);
    s[1] = Math.max(s[1], X.chromaFloor * bases[i][1]);
  });

  // 7. Out to sRGB
  const sky = stops.map(fromOklchEdge) as [RGB, RGB, RGB];

  // The glow: warmer in warm air; in the cold only whiter, since a cool tint would turn its butter green.
  // As strong as the sun and as the weather lets through, never below `glowFloor` of that.
  const [gL, gC, gh] = toOklch([base.glow[0], base.glow[1], base.glow[2]]);
  const [ga, gb] = a.warmth > 0 ? [wa, wb] : [0, 0];
  const [, gC1, gh1] = fromLab([gL, gC * Math.cos(gh) + ga, gC * Math.sin(gh) + gb]);
  const glowRGB = fromOklchEdge([gL, gC1 * (1 - X.coldGlowChroma * Math.max(0, -a.warmth)), gh1]);
  const glowAlpha =
    base.glow[3] *
    sun(GLOW_MIN, GLOW_MAX) *
    Math.max(
      X.glowFloor,
      1 -
      combined(
        X.cloudGlow * a.cloudiness,
        X.hazeGlow * haze,
        X.wetGlow * a.wetness,
        X.snowGlow * a.snow,
        X.stormGlow * a.severity,
      ),
    );

  return { sky, glow: [...glowRGB, glowAlpha] };
}

/**
 * How much depth the air leaves the scene (WTH-046F): 1 in clear air, falling
 * to 0 as haze passes `hazeOnset` towards its full value, on the same curve as
 * the sky's veil. The map's far layers lose their contrast with it (see
 * `mapInks`), so a foggy city reads close and flat, in grayscale too.
 */
export function atmosphereDepth(a: AtmosphereAxes): number {
  return 1 - smooth(ATMOSPHERE_LIMITS.hazeOnset, 1, a.haze);
}

/** The most the weather moves the map's hierarchy, each at the axis's full value (WTH-046G) */
export const MAP_WEATHER_LIMITS = {
  /** Clear, sunny, open air makes the ground richer (opacity and chroma) */
  clearTerrain: 0.15,
  clearChroma: 0.1,
  /** Rain quiets the ground, strengthens the water, deepens it, and firms the roads a little */
  wetTerrain: 0.3,
  wetWater: 0.35,
  wetDeepen: 0.06,
  wetRoads: 0.15,
  wetChroma: 0.15,
  /** Snow separates the water, brightens the land, cools the lines and restrains the infrastructure */
  snowWater: 0.25,
  snowLift: 0.1,
  snowChroma: 0.35,
  snowRoads: 0.08,
  snowBuildings: 0.08,
  /** A storm compresses the background, sharpens the roads and the ways of getting about, deepens the water */
  stormTerrain: 0.45,
  stormBuildings: 0.15,
  stormRoads: 0.25,
  stormWater: 0.1,
  stormDeepen: 0.03,
  /** No weight goes under this share of its plane's opacity */
  floor: 0.4,
} as const;

/**
 * The atmosphere as the map's hierarchy (WTH-046G): weights on the planes, chroma, and the land and water's
 * lightness, bounded and continuous, with `atmosphereDepth` for haze. Rain is darker, denser, water-first;
 * snow brighter, quieter and cooler, water kept apart; a storm compressed in the background and graphic in
 * the roads; a clear open day richer. Each is zero at zero, so a plain atmosphere is `CLEAR_MAP`.
 */
export function mapVisualState(a: AtmosphereAxes): MapVisualState {
  const X = MAP_WEATHER_LIMITS;
  const depth = atmosphereDepth(a);
  const clear = clamp01(a.daylight * (1 - a.cloudiness) * depth);
  const keep = (w: number) => Math.max(X.floor, w);
  return {
    depth,
    terrainWeight: keep((1 + X.clearTerrain * clear) * (1 - X.wetTerrain * a.wetness) * (1 - X.stormTerrain * a.severity)),
    waterWeight: 1 + X.wetWater * a.wetness + X.snowWater * a.snow + X.stormWater * a.severity,
    roadWeight: keep((1 + X.wetRoads * a.wetness + X.stormRoads * a.severity) * (1 - X.snowRoads * a.snow)),
    buildingWeight: keep((1 - X.snowBuildings * a.snow) * (1 - X.stormBuildings * a.severity)),
    saturation: (1 + X.clearChroma * clear) * (1 - X.snowChroma * a.snow) * (1 - X.wetChroma * a.wetness),
    landLift: X.snowLift * a.snow,
    waterDeepen: X.wetDeepen * a.wetness + X.stormDeepen * a.severity,
  };
}

/**
 * The whole palette from the atmosphere: `atmosphereSky`, then the same text
 * protection, glass, markers and map as the live page, the map in the
 * weather's hierarchy and depth (`mapVisualState`). The clouds' marker turns from white to slate continuously with rain
 * and storm.
 */
export function atmospherePalette(light: number, a: AtmosphereAxes): SkyPalette {
  const { sky, glow } = atmosphereSky(light, a);
  const rain = clamp01(1.5 * Math.max(a.wetness, a.severity));
  const dark = isDark(light);
  const cloud: RGBA = [...mix(WHITE, RAIN_CLOUD, rain), dark ? 0.06 + 0.01 * rain : 0.2];
  return finishPalette(sky, glow, light, cloud, mapVisualState(a), true);
}
