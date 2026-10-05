/** OpenWeather refreshes One Call 4.0 every 10 minutes; we cache on the same cadence. */
export const WEATHER_REVALIDATE_SECONDS = 600;

/**
 * A cached reading older than this is not shown. After a long idle period the
 * cache serves its last entry once (stale-while-revalidate); for weather that
 * could be days old, so we bypass the cache and fetch again instead.
 */
export const MAX_DATA_AGE_SECONDS = 60 * 60;

/** Place names practically never change. */
export const GEOCODE_REVALIDATE_SECONDS = 60 * 60 * 24 * 7;

/** Coordinates are rounded to ~1 km so nearby requests share one cache entry. */
export const COORD_PRECISION = 2;

import type { Condition } from "@/types/weather";

/** Skies that bring precipitation. */
export function isWet(condition: Condition): boolean {
  return condition === "drizzle" || condition === "rain" || condition === "thunderstorm" || condition === "snow";
}

/** Cloud cover (%) typical of each sky, for moments where only the condition is known. */
export const TYPICAL_CLOUD_COVER: Record<Condition, number> = {
  clear: 4,
  "partly-cloudy": 40,
  cloudy: 92,
  fog: 70,
  drizzle: 90,
  rain: 96,
  thunderstorm: 100,
  snow: 95,
};

export const DEFAULT_PLACE = {
  name: "Milano",
  region: "Lombardia",
  country: "IT",
  lat: 45.46,
  lon: 9.19,
};

/** Thresholds used by the narrative engine and the weather state. */
export const THRESHOLDS = {
  /** mm/h below which minute precipitation is treated as dry */
  minutePrecip: 0.1,
  /** probability above which an hour counts as "rain likely" */
  precipProbability: 0.5,
  /** °C change over the next hours worth mentioning */
  tempSwing: 4,
  /** km/h gusts considered strong */
  strongGust: 50,
  /** UV index considered high */
  highUv: 6,
  /** minutes around sunrise/sunset treated as dawn/dusk */
  twilightMinutes: 40,
} as const;
