import { HAZE_ONSET, type AtmosphereAxes } from "./atmosphere";

/**
 * The type a record is set in, worked out from its atmosphere (WTH-187, from the Type Engine research of 2026-10-05).
 * The sibling of `mapVisualState`: the same axes, one owner per property, bounded limits, no randomness.
 * The family never changes (Archivo variable for display, IBM Plex Mono for micro text); the weather
 * moves only its axes, its size, its tone and the composition it asks for. Micro text never moves:
 * it is the constant that keeps every record in one collection.
 *
 * Calibrated on three hand-made posters (Poster Lab, round 01): Milan 8 fog, Tshuru 31 clear, Tokyo 18 rain.
 * Daylight and energy are deliberately ignored: the time of day is the palette's job, not the type's.
 * Wind is ignored too (parked with motion, WTH-046M).
 */
export type RecordMode = "open-atlas" | "collision" | "field-record";

export interface TypeSetting {
  /** Archivo `wght`, 100..900 */
  readonly weight: number;
  /** Archivo `wdth`, 62..125 */
  readonly width: number;
  /** Letter spacing in em */
  readonly tracking: number;
}

export interface TypeVisualState {
  readonly mode: RecordMode;
  /** Which large element leads; the other one supports */
  readonly dominant: "temperature" | "place";
  /** The place name set as a column of letters (field record) or on one line */
  readonly placeStacked: boolean;
  readonly display: TypeSetting;
  readonly support: TypeSetting;
  /** Font size of the dominant temperature as a share of the poster height */
  readonly scale: number;
  /** Share of the dominant that may leave the canvas, 0..maxBleed */
  readonly bleed: number;
  /** Strength of the dominant's ink against the paper, 1 solid, lower in haze */
  readonly tone: number;
  /** The temperature spelled out next to the numeral ("eight", "thirty-one") */
  readonly numeralWord: boolean;
}

export const TYPE_WEATHER_LIMITS = {
  /** Warmth to display weight: cold is light, heat is heavy (anchors, smooth between them) */
  weightAnchors: [[-1, 160], [-0.4, 280], [0, 420], [0.6, 880], [1, 900]] as const,
  /** Haze and snow make the type lighter, storm and rain heavier */
  hazeLightens: 140,
  snowLightens: 120,
  stormWeighs: 360,
  rainWeighs: 120,
  /** Heat, rain and storm condense the letters; cold, haze and snow widen them */
  heatCondenses: 62,
  rainCondenses: 38,
  stormCondenses: 38,
  coldWidens: 25,
  hazeWidens: 25,
  snowWidens: 25,
  /** Heat and storm close the letters up, snow and haze open them */
  heatTightens: 0.035,
  stormTightens: 0.015,
  snowOpens: 0.04,
  hazeOpens: 0.012,
  /** Heat makes the numeral bigger, deep cold smaller and more isolated */
  baseScale: 0.66,
  heatGrows: 0.14,
  coldShrinks: 0.1,
  /** Only extreme heat lets the numeral leave the canvas */
  maxBleed: 0.18,
  /** Haze fades the dominant towards the paper, never below this share of solid ink */
  hazeFades: 0.78,
  /** The supporting element: a step lighter than the dominant, inside a readable range */
  supportStep: 60,
  supportFloor: 300,
  supportCeiling: 820,
  /** A name set as a column needs more mass than the temperature beside it */
  stackedMass: 240,
  /** Mode thresholds */
  collisionHeat: 0.5,
  collisionSeverity: 0.6,
  fieldWetness: 0.35,
  openSnow: 0.3,
  fieldCloud: 0.9,
  fieldCloudMaxHaze: 0.5,
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smoothstep = (lo: number, hi: number, v: number) => {
  const t = clamp((v - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
};
/** The same acting haze as the atmosphere's ranking: below the onset haze does nothing */
const hazeActing = (haze: number) => smoothstep(HAZE_ONSET, 1, haze);

function along(anchors: readonly (readonly [number, number])[], x: number): number {
  if (x <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) {
    const [end, high] = anchors[i];
    if (x <= end) {
      const [start, low] = anchors[i - 1];
      return low + (high - low) * smoothstep(start, end, x);
    }
  }
  return anchors[anchors.length - 1][1];
}

export function recordMode(a: AtmosphereAxes): RecordMode {
  const X = TYPE_WEATHER_LIMITS;
  if (a.severity >= X.collisionSeverity || a.warmth >= X.collisionHeat) return "collision";
  if (a.wetness >= X.fieldWetness) return "field-record";
  if (a.snow >= X.openSnow) return "open-atlas";
  if (a.cloudiness >= X.fieldCloud && hazeActing(a.haze) < X.fieldCloudMaxHaze) return "field-record";
  return "open-atlas";
}

export function typeVisualState(a: AtmosphereAxes): TypeVisualState {
  const X = TYPE_WEATHER_LIMITS;
  const heat = Math.max(0, a.warmth);
  const cold = Math.max(0, -a.warmth);
  const haze = hazeActing(a.haze);
  const mode = recordMode(a);

  const weight = clamp(
    along(X.weightAnchors, a.warmth)
      - X.hazeLightens * haze - X.snowLightens * a.snow
      + X.stormWeighs * a.severity + X.rainWeighs * a.wetness,
    120, 900,
  );
  const width = clamp(
    100 - X.heatCondenses * heat - X.rainCondenses * a.wetness - X.stormCondenses * a.severity
      + X.coldWidens * cold + X.hazeWidens * haze + X.snowWidens * a.snow,
    62, 125,
  );
  const tracking = X.snowOpens * a.snow + X.hazeOpens * haze - X.heatTightens * heat - X.stormTightens * a.severity;

  const stacked = mode === "field-record";
  const display: TypeSetting = stacked
    ? { weight: clamp(weight + X.stackedMass, X.supportFloor, 900), width, tracking }
    : { weight, width, tracking };
  const support: TypeSetting = stacked
    ? { weight, width, tracking: 0 }
    : { weight: clamp(weight - X.supportStep, X.supportFloor, X.supportCeiling), width, tracking: 0 };

  return {
    mode,
    dominant: stacked ? "place" : "temperature",
    placeStacked: stacked,
    display,
    support,
    scale: X.baseScale + X.heatGrows * smoothstep(0.2, 0.7, a.warmth) - X.coldShrinks * smoothstep(0.4, 1, cold),
    bleed: X.maxBleed * smoothstep(0.7, 1, a.warmth),
    tone: 1 - X.hazeFades * haze,
    numeralWord: !stacked,
  };
}
