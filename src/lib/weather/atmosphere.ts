/**
 * Canonical normalized atmosphere for the Weather Visual Engine (WTH-046A).
 * Measurement curves belong to WTH-046B; this module knows no providers,
 * cities, clock, palette or WeatherState. See docs/WEATHER_VISUAL_ENGINE.md.
 */
export interface AtmosphereAxes {
  /** Available solar light, 0..1. NOT Frame.light's -1..2 phase coordinate. */
  readonly daylight: number;
  /** Thermal influence, -1 (cold) to +1 (hot), with 0 neutral. */
  readonly warmth: number;
  /** Fractional atmospheric cloud influence, 0..1. */
  readonly cloudiness: number;
  /** Loss of atmospheric depth, 0..1; not relative humidity. */
  readonly haze: number;
  /** Liquid precipitation influence, 0..1, independent of severity/snow. */
  readonly wetness: number;
  /** Storm-like visual severity, 0..1; not an official hazard rating. */
  readonly severity: number;
  /** Snow influence, 0..1; not cold rain. */
  readonly snow: number;
  /** Solar energy, 0..daylight; UV cannot supply light at night. */
  readonly energy: number;
}

export type VisualForce = "sun" | "heat" | "cold" | "cloud" | "haze" | "rain" | "snow" | "storm";

export interface AtmosphereSignature {
  /** Null when no force has positive strength (e.g. a neutral clear night). */
  readonly dominant: VisualForce | null;
  /** A distinct positive force, or null when fewer than two are present. */
  readonly secondary: VisualForce | null;
}

export interface AtmosphereState extends AtmosphereAxes {
  /** 1 - haze: optical depth available, independent of cloud coverage. */
  readonly clarity: number;
  /** Explanatory summary, never a categorical palette selector. */
  readonly signature: AtmosphereSignature;
}

// Only exact ties use this order. Strength always wins before precedence.
const FORCE_ORDER: readonly VisualForce[] = ["storm", "snow", "rain", "haze", "cloud", "cold", "heat", "sun"];

/**
 * Haze below this does nothing to depth, colour or glow (the transform's onset, WTH-046E), so it is no
 * force either: saturated air or a little mist must not rank as a visual force the picture does not show.
 */
export const HAZE_ONSET = 0.45;

/**
 * How much each force counts in the ranking (not in any colour). With precipitation cloudiness is near 1,
 * so unweighted clouds always outranked rain and snow (WTH-046K finding): cloud is background, and counts
 * for 0.6 of its value, so a rain of 0.62 or more is ahead of a full overcast.
 */
const FORCE_WEIGHT: Readonly<Record<VisualForce, number>> = {
  storm: 1,
  snow: 1,
  rain: 1,
  haze: 1,
  cloud: 0.6,
  cold: 1,
  heat: 1,
  sun: 1,
};

const hazeActing = (haze: number) => {
  const t = Math.min(1, Math.max(0, (haze - HAZE_ONSET) / (1 - HAZE_ONSET)));
  return t * t * (3 - 2 * t);
};

/**
 * Accepts already normalized, finite axes. Rejects invalid internal input
 * rather than silently treating unavailable measurements as observed zero.
 * Provider fallbacks and raw-unit normalization belong upstream in WTH-046B/C.
 */
export function createAtmosphere(axes: AtmosphereAxes): AtmosphereState {
  // Copy just the contract fields; retain no caller-owned objects or extras.
  const normalized: AtmosphereAxes = {
    daylight: axes.daylight,
    warmth: axes.warmth,
    cloudiness: axes.cloudiness,
    haze: axes.haze,
    wetness: axes.wetness,
    severity: axes.severity,
    snow: axes.snow,
    energy: axes.energy,
  };
  for (const [axis, value] of Object.entries(normalized)) {
    const min = axis === "warmth" ? -1 : 0;
    if (!Number.isFinite(value) || value < min || value > 1) {
      throw new RangeError(`Atmosphere ${axis} must be finite and within ${min}..1`);
    }
  }
  if (normalized.energy > normalized.daylight) {
    throw new RangeError("Atmosphere energy must not exceed daylight");
  }

  const clarity = 1 - normalized.haze;
  const strength: Record<VisualForce, number> = {
    sun: normalized.daylight * (1 - normalized.cloudiness) * clarity,
    heat: Math.max(0, normalized.warmth),
    cold: Math.max(0, -normalized.warmth),
    cloud: normalized.cloudiness,
    // Only the haze that acts: from the onset to full haze, on the transform's own curve
    haze: hazeActing(normalized.haze),
    rain: normalized.wetness,
    snow: normalized.snow,
    storm: normalized.severity,
  };
  const ranked = FORCE_ORDER
    .map((force, priority) => ({ force, priority, strength: strength[force], score: strength[force] * FORCE_WEIGHT[force] }))
    .filter((entry) => entry.strength > 0)
    .sort((a, b) => b.score - a.score || a.priority - b.priority);

  return Object.freeze({
    ...normalized,
    clarity,
    signature: Object.freeze({
      dominant: ranked[0]?.force ?? null,
      secondary: ranked[1]?.force ?? null,
    }),
  });
}
