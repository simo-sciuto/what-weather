import type { WeatherState } from "./state";

/**
 * The sky's colours, computed rather than picked from a table:
 *  1. a clear-sky palette that follows the light through the day — night,
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
  | "rail"
  | "buildings"
  | "buildings-3d"
  | "shadows"
  | "traffic-slow"
  | "traffic-heavy"
  | "traffic-jam"
  | "lights"
  | "water-names"
  | "waterway-names";
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

/* ---------- 1. Clear sky through the day ---------- */

/**
 * Keyed on the light scale from frames.ts: −1 night … 0 sunrise … 1 sunset … 2 night.
 * Soft pastel light over deep, quiet skies: ink-blue nights with a
 * periwinkle glow, rose and apricot dawns, a clean cerulean day under a
 * butter light, dusty rose and coral sunsets. Hues move gently from one
 * stop to the next; step 3 below still darkens each one until white text
 * reads on it.
 */
const CLEAR: { at: number; sky: [string, string, string]; glow: RGBA }[] = [
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

function clearSky(light: number): { sky: [RGB, RGB, RGB]; glow: RGBA } {
  const u = Math.min(2, Math.max(-1, light));
  const j = Math.max(
    1,
    CLEAR.findIndex((k) => k.at >= u),
  );
  const a = CLEAR[j - 1];
  const b = CLEAR[j];
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
  rail: { contrast: 1.5, minOpacity: 0.4 },
  buildings: { contrast: 1.25, minOpacity: 0.3 },
  // Volumes, not outlines: stronger, and opaque enough that the roads do not show through them
  "buildings-3d": { contrast: 1.4, minOpacity: 0.75 },
  shadows: { contrast: 1.25, minOpacity: 0.4 },
  "traffic-slow": { contrast: 2, minOpacity: 0.9 },
  "traffic-heavy": { contrast: 2.1, minOpacity: 0.95 },
  "traffic-jam": { contrast: 2.2, minOpacity: 1 },
  lights: { contrast: 2, minOpacity: 0.7 },
  // The names of the waters: pale and quiet, written in the water's own hue
  "water-names": { contrast: 1.8, minOpacity: 0.7 },
  "waterway-names": { contrast: 1.8, minOpacity: 0.7 },
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

/**
 * `tune` moves all the lines together from the colours described above: the
 * hue turns them round the wheel, `vivid` scales their chroma (deepening them
 * to make room for it), `contrast` scales how far from the sky each must
 * stand. A line too deep to read once fully opaque is lightened until it does.
 */
function mapInks(sky: RGB, tune: MapTune = UNTUNED): Record<MapLayer, MapInk> {
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
    rail: road(0.9, 0.06, opposite - towardButter * deg(35)),
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
    "water-names": road(0.94, 0.05, hue),
    "waterway-names": road(0.94, 0.05, hue),
  };
  /**
   * A layer drawn from a base colour: lightened and made opaque as far as it takes to stand out
   * from the sky as it must, whatever the tuning (see the contrast above). `firmer` starts it more
   * opaque than it needs to be, to stand further from the sky and from the layers beside it.
   */
  const settle = (layer: MapLayer, from: LCH, firmer = 1): MapInk => {
    const base = MAP_INK[layer];
    const target = 1 + (base.contrast - 1) * k;
    // What a line must reach whatever the tuning, by lightening if its opacity alone can't: the
    // viewer's softer contrast when they asked for one, the page's own otherwise.
    const floor = Math.min(target, base.contrast);
    const [, c, h] = from;
    let l = from[0];
    for (;;) {
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
      if (
        seen(opacity) >= floor ||
        l >= LIGHTEST ||
        l < L ||
        KEEP_TONE.has(layer)
      ) {
        const result: MapInk = {
          color: toHex(ink),
          opacity: +opacity.toFixed(2),
        };
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
      }
      l += 0.02;
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
  const ROADS: readonly MapLayer[] = ["streets", "main-roads", "motorways"];

  /**
   * Keeps a group of layers (water, buildings) clear of the ones it lies among: if the colour it came
   * out in is closer than MAP_SEPARATION (less if the viewer asked for a fainter map) to any of theirs, it is looked for again among variants of
   * itself, the nearest to the intended colour first (the same hue a little darker or more vivid, then
   * a turn of the hue, then both), and the first that clears the gap is taken. If none does, the one
   * that comes nearest to it is.
   */
  const keepApart = (
    group: readonly MapLayer[],
    among: readonly MapLayer[],
  ) => {
    const wanted = MAP_SEPARATION * Math.min(1, k);
    /** The group's layers drawn from one base; its gap is its worst layer's */
    const draw = (from: LCH, firmer: number) => {
      const drawn = Object.fromEntries(
        group.map((layer) => [layer, settle(layer, from, firmer)]),
      ) as Record<string, MapInk>;
      return {
        drawn,
        gap: Math.min(...group.map((layer) => gapFrom(drawn[layer], among))),
      };
    };
    const [l0, c0, h0] = colors[group[0]];
    let best = { ...draw(colors[group[0]], 1), from: colors[group[0]] };
    if (best.gap >= wanted) return;
    // What separates a layer from its neighbours, nearest to its own colour first: lighter or darker,
    // more opaque, a turn of the hue
    const variants: { from: LCH; firmer: number; cost: number }[] = [];
    for (const turnBy of [0, 90, -90, 180]) {
      for (const dl of [0, -0.12, -0.24, -0.34]) {
        for (const firmer of [1, 1.8]) {
          const l = l0 + dl;
          if (l < 0.3) continue;
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
    for (const { from, firmer } of variants) {
      const tried = draw(from, firmer);
      if (tried.gap > best.gap) best = { ...tried, from };
      if (tried.gap >= wanted) break;
    }
    Object.assign(inks, best.drawn);
  };
  // The roads carry the drawing and the viewer's hue, so they stay as they are; the water gives way
  // to them, and the buildings to both.
  keepApart(["water", "waterway"], ROADS);
  keepApart(["buildings", "buildings-3d"], [...ROADS, "water"]);
  return inks;
}

/**
 * The map's lines over a sky (a palette's `sky2`) as the viewer tuned them
 * (see MapControls): their hue, how vivid, how strong against the sky.
 */
export function mapInksFor(
  sky: string,
  tune: MapTune,
): Record<MapLayer, MapInk> {
  // Worked out once per sky and tuning: scrubbing the timeline asks again and again for the same few
  const key = `${sky}|${tune.hue}|${tune.vivid}|${tune.contrast}`;
  const known = inksMemo.get(key);
  if (known) return known;
  const inks = mapInks(hex(sky), tune);
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

export function skyPalette({
  light,
  state,
  cloudCover,
  uv,
}: {
  light: number;
  state: WeatherState;
  cloudCover: number;
  /** The UV index; without it (not every provider has one) the colours are the table's own */
  uv?: number;
}): SkyPalette {
  const { sky, glow: tableGlow } = clearSky(light);
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

  // Text sits on every part of the sky: the reading at the top, and — as the
  // page scrolls over the fixed sky — chapter titles and the footer on the
  // horizon. All of it stays at AA; the glow still brightens the light source.
  const sky1 = legibleUnderText(weathered[0], 4.8);
  const sky2 = legibleUnderText(weathered[1], 4.6);
  const sky3 = legibleUnderText(weathered[2], 4.5);

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
  const dark = light < -0.3 || light > 1.3;

  return {
    sky1: toHex(sky1),
    sky2: toHex(sky2),
    sky3: toHex(sky3),
    glass: rgba([...veil, alpha]),
    glow: rgba(glow),
    // The "now" markers: the glow's own colour by day, a periwinkle moonlight at night.
    sun: dark ? "#bfcbfe" : toHex([glow[0], glow[1], glow[2]]),
    cloud: rgba(
      state === "RAIN" || state === "HEAVY_RAIN" || state === "STORM"
        ? [205, 214, 226, dark ? 0.07 : 0.2]
        : [255, 255, 255, dark ? 0.06 : 0.2],
    ),
    map: mapInks(sky2),
  };
}
