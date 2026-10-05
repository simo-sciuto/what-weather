import { HOUR_SECONDS, DAY_SECONDS } from "@/constants/time";
import { CONDITION_NAMES, WIND_LABELS, MOON_LABELS, HIGH_UV_LABEL, LEVEL_LABELS } from "@/constants/labels";
import { THRESHOLDS } from "@/constants/weather";
import { localDay } from "./formatters";
import { illumination, moonPhaseAt, phaseName, secondsUntilPhase } from "./moon";
import { hasSunTimes } from "./sun";
import type { AirQuality, Pollen, Pollutants, WeatherData } from "@/types/weather";

/**
 * Derived readings for the detail modules, plus the rules deciding which
 * modules are promoted. Pure functions of WeatherData; no presentation.
 */

/* ---------- Wind ---------- */

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
const COMPASS_WORDS: Record<string, string> = {
  N: "nord", NE: "nord-est", E: "est", SE: "sud-est", S: "sud", SO: "sud-ovest", O: "ovest", NO: "nord-ovest",
};

function compassPoint(deg: number): string {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

/** Beaufort description for a wind speed in km/h. */
function beaufort(kmh: number): string {
  const scale: [number, string][] = [
    [1, WIND_LABELS.calm], [6, "Bava di vento"], [12, "Brezza leggera"], [20, "Brezza tesa"], [29, "Vento moderato"],
    [39, "Vento teso"], [50, "Vento fresco"], [62, "Vento forte"], [75, "Burrasca"], [89, "Burrasca forte"],
    [103, "Tempesta"],
  ];
  return scale.find(([max]) => kmh < max)?.[1] ?? "Tempesta violenta";
}

export function windInfo(d: WeatherData) {
  const { windSpeed, windGust, windDeg } = d.current;
  const point = compassPoint(windDeg);
  return {
    speed: windSpeed,
    gust: windGust,
    deg: windDeg,
    point,
    /** "da nord-ovest", for sentences and screen readers */
    fromWords: `da ${COMPASS_WORDS[point] ?? point}`,
    description: beaufort(windSpeed),
    strong: (windGust ?? windSpeed) >= THRESHOLDS.strongGust || windSpeed >= 40,
  };
}

/* ---------- Humidity ---------- */

/**
 * How the air feels. Dew point drives muggy-vs-comfortable; relative humidity
 * catches the ends a dew point alone misreads (cold saturated air isn't "dry").
 */
export function comfort(dewPoint: number, humidity: number): string {
  if (dewPoint >= 22) return "Afoso";
  if (dewPoint >= 19) return "Umido";
  if (dewPoint >= 16) return "Leggermente umido";
  if (humidity >= 90) return "Aria satura";
  if (humidity < 30) return "Secco";
  return "Confortevole";
}

/* ---------- Pressure ---------- */

type PressureTrend = "rising" | "steady" | "falling";

/**
 * Tendency over the next ~6 hours, from forecast points only (mixing a station
 * reading with model values would show their bias as a trend). Null when the
 * forecast doesn't cover the window.
 */
export function pressureTrend(d: WeatherData): { trend: PressureTrend; change: number; series: { time: number; pressure: number }[] } | null {
  const now = d.current.time;
  const ahead = d.hourly.filter((h) => h.time > now - 1800 && h.time <= now + 24 * HOUR_SECONDS);
  if (ahead.length < 2) return null;
  const base = ahead[0];
  const later = ahead.find((h) => h.time >= base.time + 6 * HOUR_SECONDS - 1800);
  if (!later) return null;
  const change = later.pressure - base.pressure;
  const trend: PressureTrend = change >= 2 ? "rising" : change <= -2 ? "falling" : "steady";
  return { trend, change, series: ahead.map((h) => ({ time: h.time, pressure: h.pressure })) };
}

/* ---------- Visibility ---------- */

export function visibilityInfo(km: number) {
  const description = km < 1 ? CONDITION_NAMES.fog : km < 4 ? "Foschia" : km < 10 ? "Buona" : "Ottima";
  return { km, description, capped: km >= 10, poor: km < 1 };
}

/* ---------- UV ---------- */

function uvCategory(uv: number): string {
  if (uv < 3) return LEVEL_LABELS[0];
  if (uv < 6) return LEVEL_LABELS[1];
  if (uv < 8) return LEVEL_LABELS[2];
  if (uv < 11) return LEVEL_LABELS[3];
  return "Estremo";
}

/** Current UV and today's remaining peak; null when the provider has no UV. */
export function uvInfo(d: WeatherData) {
  if (d.current.uvIndex == null) return null;
  const today = localDay(d.current.time, d.timezone);
  const rest = d.hourly.filter(
    (h): h is typeof h & { uvIndex: number } =>
      h.uvIndex != null && h.time > d.current.time && localDay(h.time, d.timezone) === today,
  );
  const peak = rest.reduce<(typeof rest)[number] | null>((a, b) => (!a || b.uvIndex > a.uvIndex ? b : a), null);
  const now = d.current.uvIndex;
  const max = Math.max(now, peak?.uvIndex ?? 0);
  return {
    now,
    // Categorize the number people see, so "6" never reads "Moderate".
    category: uvCategory(Math.round(now)),
    /** Only when the rest of today gets meaningfully higher than now */
    peak: peak && peak.uvIndex >= now + 1 ? { value: peak.uvIndex, time: peak.time } : null,
    high: Math.round(max) >= THRESHOLDS.highUv,
  };
}

/* ---------- Air quality ---------- */

/**
 * Named for what the air does to you, not after OpenWeather's own words: its
 * third band ("Moderate": PM2.5 from 25 μg/m³) is already well past the WHO's
 * daily guideline (15 μg/m³), so it reads as poor here, and the two above it
 * as very poor and worst.
 */
export const AQI_LABELS = ["Buona", "Discreta", "Scarsa", "Molto scarsa", "Pessima"] as const;

/**
 * Band thresholds in μg/m³ (lower bound of Fair, Moderate, Poor, Very poor),
 * as published by OpenWeather for its 1–5 index.
 */
const POLLUTANT_BANDS: Record<keyof Pollutants, [number, number, number, number]> = {
  pm2_5: [10, 25, 50, 75],
  pm10: [20, 50, 100, 200],
  o3: [60, 100, 140, 180],
  no2: [40, 70, 150, 200],
  so2: [20, 80, 250, 350],
  co: [4400, 9400, 12400, 15400],
};

export const POLLUTANT_NAMES: Record<keyof Pollutants, { short: string; long: string }> = {
  pm2_5: { short: "PM2.5", long: "Particolato fine" },
  pm10: { short: "PM10", long: "Particolato grossolano" },
  o3: { short: "O₃", long: "Ozono" },
  no2: { short: "NO₂", long: "Biossido di azoto" },
  so2: { short: "SO₂", long: "Biossido di zolfo" },
  co: { short: "CO", long: "Monossido di carbonio" },
};

/** Band 1–5 of a single pollutant, and how far through the scale it sits (0..1). */
function pollutantBand(key: keyof Pollutants, value: number) {
  const t = POLLUTANT_BANDS[key];
  const band = 1 + t.filter((x) => value >= x).length;
  // Position on a 0..1 scale where each band gets an equal fifth.
  const edges = [0, ...t, t[3] * 1.5];
  const i = band - 1;
  const within = Math.min(1, (value - edges[i]) / (edges[i + 1] - edges[i]));
  return { band, position: (i + within) / 5 };
}

/** The 1–5 index from concentrations alone: the worst band of any pollutant (for providers that give no index). */
export function airIndexOf(pollutants: Pollutants): AirQuality["index"] {
  const keys = Object.keys(POLLUTANT_BANDS) as (keyof Pollutants)[];
  return Math.max(...keys.map((k) => pollutantBand(k, pollutants[k]).band)) as AirQuality["index"];
}

export function airInfo(aq: AirQuality) {
  const keys = Object.keys(POLLUTANT_BANDS) as (keyof Pollutants)[];
  const bands = keys.map((k) => ({ key: k, value: aq.pollutants[k], ...pollutantBand(k, aq.pollutants[k]) }));
  // The pollutant driving the index: highest band, then furthest into it.
  const dominant = [...bands].sort((a, b) => b.position - a.position)[0];
  return {
    index: aq.index,
    label: AQI_LABELS[aq.index - 1],
    poor: aq.index >= 3,
    dominant,
    /** Shown first; the rest sit behind a disclosure */
    headline: bands.filter((b) => b.key === "pm2_5" || b.key === "pm10"),
    others: bands.filter((b) => b.key !== "pm2_5" && b.key !== "pm10"),
  };
}

/* ---------- Pollen ---------- */

/**
 * Lower bounds in grains/m³ of Moderate, High and Very high for each family,
 * after the bands of the US National Allergy Bureau (AAAAI). Those are for a
 * day's count at a station and these readings are a model's, for the hour: a
 * guide, not a measurement.
 */
const POLLEN_BANDS: Record<"tree" | "grass" | "weed", [number, number, number]> = {
  tree: [15, 90, 1500],
  grass: [5, 20, 200],
  weed: [10, 50, 500],
};
const POLLEN_NAMES = { tree: "Alberi", grass: "Graminacee", weed: "Erbe infestanti" } as const;

/** The families in the air (a grain per m³ or more), highest level first; null when there are none. */
export function pollenInfo(p: Pollen) {
  const keys = Object.keys(POLLEN_BANDS) as (keyof typeof POLLEN_BANDS)[];
  const families = keys
    .filter((k) => p[k] >= 1)
    .map((k) => {
      const band = 1 + POLLEN_BANDS[k].filter((x) => p[k] >= x).length;
      return { key: k, name: POLLEN_NAMES[k], grains: p[k], band, label: LEVEL_LABELS[band - 1] };
    })
    .sort((a, b) => b.band - a.band || b.grains - a.grains);
  if (!families.length) return null;
  const band = families[0].band;
  return { band, label: LEVEL_LABELS[band - 1], high: band >= 3, families };
}

/* ---------- Sun ---------- */

/** Null in polar day or night, when there is no sunrise or sunset to show. */
export function sunInfo(d: WeatherData) {
  if (!hasSunTimes(d)) return null;
  const now = d.current.time;
  const day = d.sunset - d.sunrise;
  const tomorrowRise =
    d.daily.find((x) => x.sunrise && x.sunrise > now)?.sunrise ?? d.sunrise + DAY_SECONDS;
  const isDay = now >= d.sunrise && now <= d.sunset;
  const next = now < d.sunrise
    ? { type: "sunrise" as const, time: d.sunrise }
    : isDay
      ? { type: "sunset" as const, time: d.sunset }
      : { type: "sunrise" as const, time: tomorrowRise };
  return {
    sunrise: d.sunrise,
    sunset: d.sunset,
    daylightSeconds: day,
    /** 0 at sunrise, 1 at sunset; outside 0..1 at night */
    progress: (now - d.sunrise) / day,
    isDay,
    next,
    inSeconds: next.time - now,
  };
}

/* ---------- Moon ---------- */

function upcomingPhase(phase: number): string | null {
  const full = secondsUntilPhase(phase, 0.5) / DAY_SECONDS;
  const fresh = secondsUntilPhase(phase, 0) / DAY_SECONDS;
  const days = Math.round(Math.min(full, fresh));
  if (days === 0) return null;
  return `${full <= fresh ? MOON_LABELS.fullMoon : MOON_LABELS.newMoon} tra ${days} ${days === 1 ? "giorno" : "giorni"}`;
}

export function moonInfo(d: WeatherData) {
  const today = localDay(d.current.time, d.timezone);
  const day = d.daily.find((x) => localDay(x.time, d.timezone) === today);
  const phase = day?.moonPhase ?? moonPhaseAt(d.current.time);
  return {
    phase,
    name: phaseName(phase),
    illumination: illumination(phase),
    moonrise: day?.moonrise,
    moonset: day?.moonset,
    /** "Luna piena tra 5 giorni" or "Luna nuova tra 12 giorni", whichever comes first */
    upcoming: upcomingPhase(phase),
    /** The moon appears mirrored in the southern hemisphere */
    southern: d.place.lat < 0,
  };
}

/* ---------- Which modules, in which order ---------- */

export type DetailKey = "wind" | "humidity" | "uv" | "air" | "pollen" | "sun" | "moon" | "pressure" | "visibility";

export type DetailModule = {
  key: DetailKey;
  /** Promoted modules move to the front and take more room */
  promoted: boolean;
  /** The weather made it urgent: an accent outline and a note saying why */
  alert: boolean;
  note?: string;
};

/**
 * Calm weather: a quiet, fixed order (secondary before tertiary). Notable
 * weather: the modules that matter jump to the front, most severe first.
 * Air quality always sits at the front, as a card: marked as an alert only
 * when the air is poor, after anything that is.
 */
export function detailModules(d: WeatherData): DetailModule[] {
  const wind = windInfo(d);
  const uv = uvInfo(d);
  const vis = visibilityInfo(d.current.visibility);
  const pressure = pressureTrend(d);
  const air = d.airQuality ? airInfo(d.airQuality) : null;
  const pollen = d.pollen ? pollenInfo(d.pollen) : null;

  const modules: (Omit<DetailModule, "alert"> & { severity: number })[] = [
    { key: "wind", promoted: wind.strong, note: wind.strong ? "Vento forte" : undefined, severity: 3 },
    { key: "humidity", promoted: false, severity: 0 },
    ...(uv ? [{ key: "uv" as const, promoted: uv.high, note: uv.high ? HIGH_UV_LABEL : undefined, severity: 2 }] : []),
    ...(air
      ? [{ key: "air" as const, promoted: true, note: air.poor ? `Aria ${air.label.toLowerCase()}` : undefined, severity: air.poor ? 2 : 0 }]
      : []),
    ...(pollen
      ? [{ key: "pollen" as const, promoted: pollen.high, note: pollen.high ? `Polline ${pollen.label.toLowerCase()}` : undefined, severity: 1 }]
      : []),
    ...(hasSunTimes(d) ? [{ key: "sun" as const, promoted: false, severity: 0 }] : []),
    { key: "moon", promoted: false, severity: 0 },
    {
      key: "pressure",
      promoted: pressure != null && pressure.change <= -5,
      note: pressure != null && pressure.change <= -5 ? "In calo rapido" : undefined,
      severity: 1,
    },
    { key: "visibility", promoted: vis.poor, note: vis.poor ? "Visibilità scarsa" : undefined, severity: 1 },
  ];

  const promoted = modules.filter((m) => m.promoted).sort((a, b) => b.severity - a.severity);
  const rest = modules.filter((m) => !m.promoted);
  // Every promoted module is an alert except air that isn't poor (it has no note then).
  return [...promoted, ...rest].map(({ key, promoted: p, note }) => ({
    key,
    promoted: p,
    alert: p && (key !== "air" || note != null),
    note,
  }));
}
