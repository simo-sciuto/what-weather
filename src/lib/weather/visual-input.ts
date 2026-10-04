import { createAtmosphere, type AtmosphereState } from "./atmosphere";
import { TYPICAL_CLOUD_COVER } from "./constants";
import type { Condition, Intensity } from "./types";

/** Project units, never provider payloads. Missing measurements stay missing. */
export interface WeatherVisualInput {
  /** Existing Frame.light coordinate: -1..2, sunrise 0, sunset 1. */
  readonly light?: number | null;
  /** Degrees C, NOT feels-like temperature. */
  readonly temp?: number | null;
  /** Percent, 0..100. */
  readonly cloudCover?: number | null;
  readonly humidity?: number | null;
  /** km, never metres. */
  readonly visibility?: number | null;
  /** Degrees C. */
  readonly dewPoint?: number | null;
  /** Combined precipitation in mm/h, as in WeatherData. See phase policy below. */
  readonly precipitation?: number | null;
  readonly uvIndex?: number | null;
  readonly condition?: Condition | null;
  readonly intensity?: Intensity | null;
}

/** "supplied" does not imply observed: an upstream value may be estimated. */
export type VisualInputStatus = "supplied" | "clamped" | "missing" | "invalid";
type Measurement = Exclude<keyof WeatherVisualInput, "condition" | "intensity">;
export interface AtmosphereComputation {
  readonly atmosphere: AtmosphereState;
  /** Local input handling only; upstream measurement provenance stays upstream. */
  readonly inputStatus: Readonly<Record<Measurement, VisualInputStatus>>;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const smoothstep = (low: number, high: number, value: number) => {
  const t = clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
};

const WARMTH: readonly (readonly [number, number])[] = [
  [-15, -1], [-5, -0.8], [5, -0.5], [12, -0.25], [18, 0],
  [24, 0.25], [30, 0.6], [36, 0.9], [42, 1],
];

function warmthAt(temp: number): number {
  if (temp <= WARMTH[0][0]) return -1;
  for (let i = 1; i < WARMTH.length; i++) {
    const [end, high] = WARMTH[i];
    if (temp <= end) {
      const [start, low] = WARMTH[i - 1];
      // Monotone, continuous with zero slope at each calibration anchor.
      return low + (high - low) * smoothstep(start, end, temp);
    }
  }
  return 1;
}

const RAIN_FALLBACK: Record<Intensity, number> = { light: 0.5, moderate: 2, heavy: 8 };
const DRIZZLE_FALLBACK: Record<Intensity, number> = { light: 0.2, moderate: 0.5, heavy: 1 };
const SNOW_FALLBACK: Record<Intensity, number> = { light: 0.3, moderate: 0.6, heavy: 0.9 };
const STORM_SEVERITY: Record<Intensity, number> = { light: 0.75, moderate: 0.9, heavy: 1 };
const precipInfluence = (rate: number) => clamp(Math.log1p(rate) / Math.log1p(12), 0, 1);
// Water equivalent: 2 mm/h is already heavy snow, so snow reaches its full value much sooner than rain does
const snowInfluence = (rate: number) => clamp(Math.log1p(rate) / Math.log1p(2), 0, 1);

/**
 * Deterministic measurement -> atmosphere boundary (WTH-046B).
 * Curves/fallbacks are initial calibration hypotheses, not meteorological laws.
 * No wind, clock, city, palette or provider dependency. Frame mapping is owned by look.ts.
 */
export function computeAtmosphere(input: WeatherVisualInput): AtmosphereComputation {
  const inputStatus = {} as Record<Measurement, VisualInputStatus>;
  function read(key: Measurement, low = -Infinity, high = Infinity): number | undefined {
    const value = input[key];
    if (value == null) {
      inputStatus[key] = "missing";
      return undefined;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      inputStatus[key] = "invalid";
      return undefined;
    }
    const bounded = clamp(value, low, high);
    inputStatus[key] = bounded === value ? "supplied" : "clamped";
    return bounded;
  }

  const light = read("light", -1, 2);
  const temp = read("temp");
  const cloudCover = read("cloudCover", 0, 100);
  const humidity = read("humidity", 0, 100);
  const visibility = read("visibility", 0);
  const dewPoint = read("dewPoint");
  const precipitation = read("precipitation", 0);
  const uv = read("uvIndex", 0);
  const intensity = input.intensity ?? "moderate";

  // Match the existing palette's solar-light gate, keeping phase separate.
  const daylight = light == null || light <= 0 || light >= 1
    ? 0 : clamp(2 * Math.sin(Math.PI * light), 0, 1);
  const clouds = cloudCover ?? (input.condition ? TYPICAL_CLOUD_COVER[input.condition] : 0);

  // The normalized project model combines rain and snow. Use the condition
  // to interpret that amount; do not double-count it as both rain and snow.
  // Unknown/non-snow phase uses liquid interpretation, a documented limitation.
  const isSnow = input.condition === "snow";
  const rainFallback = input.condition === "drizzle" ? DRIZZLE_FALLBACK[intensity]
    : input.condition === "rain" || input.condition === "thunderstorm" ? RAIN_FALLBACK[intensity] : 0;
  const liquidRate = isSnow ? 0 : precipitation ?? rainFallback;
  const snow = !isSnow ? 0 : precipitation == null ? SNOW_FALLBACK[intensity] : snowInfluence(precipitation);
  const wetness = precipInfluence(liquidRate);
  const rainSeverity = 0.6 * smoothstep(2, 12, liquidRate);
  const severity = Math.max(rainSeverity, input.condition === "thunderstorm" ? STORM_SEVERITY[intensity] : 0);

  // Keep absent contributions at zero rather than amplify remaining signals.
  // Only missing visibility may use the explicit fog condition as a fallback.
  const visibilityLoss = visibility == null
    ? (input.condition === "fog" ? 1 : 0)
    : 1 - smoothstep(1, 10, visibility);
  const dewProximity = temp == null || dewPoint == null ? 0 : 1 - smoothstep(0, 8, temp - dewPoint);
  const humidityFactor = humidity == null ? 0 : smoothstep(0.45, 0.98, humidity / 100);
  // Visibility leads (0.65): saturated air alone gives 0.35, below the transform's onset, so rain with a
  // good view stays clear of depth; thick haze needs lost visibility on top of it (WTH-046K).
  // Rain is rain, snow is snow, fog is fog: the view a fall takes away is the fall's (its own axis), up to its
  // own strength; only the rest is haze, so precipitation is never counted twice (WTH-046K).
  const precipitationLoss = Math.max(wetness, snow);
  const hazeLoss = Math.max(0, visibilityLoss - precipitationLoss);
  const haze = clamp(0.65 * hazeLoss + 0.25 * dewProximity + 0.10 * humidityFactor, 0, 1);

  return Object.freeze({
    atmosphere: createAtmosphere({
      daylight,
      warmth: temp == null ? 0 : warmthAt(temp),
      cloudiness: smoothstep(0, 100, clouds),
      haze,
      wetness,
      severity,
      snow,
      // Absent UV uses a neutral mid-curve reference, not a measured zero.
      energy: daylight * smoothstep(0, 8, uv ?? 4),
    }),
    inputStatus: Object.freeze(inputStatus),
  });
}
