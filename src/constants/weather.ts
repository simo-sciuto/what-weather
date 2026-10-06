import type { Condition } from "@/types/weather";

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
