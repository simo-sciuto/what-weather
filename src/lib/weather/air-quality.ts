import type { AirQuality, Pollutants } from "@/types/weather";

/**
 * Band thresholds in μg/m³ (lower bound of Fair, Moderate, Poor, Very poor),
 * as published by OpenWeather for its 1–5 index.
 */
export const POLLUTANT_BANDS: Record<keyof Pollutants, [number, number, number, number]> = {
  pm2_5: [10, 25, 50, 75],
  pm10: [20, 50, 100, 200],
  o3: [60, 100, 140, 180],
  no2: [40, 70, 150, 200],
  so2: [20, 80, 250, 350],
  co: [4400, 9400, 12400, 15400],
};

/** Band 1–5 of a single pollutant, and how far through the scale it sits (0..1). */
export function pollutantBand(key: keyof Pollutants, value: number) {
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
