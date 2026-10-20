import type { Condition, Intensity } from "@/types/weather";

/**
 * The weather at given heights along a route or at a summit (ADR-031, docs/VERDICT.md): not the weather of a place
 * (`WeatherData`, a near-ground reading for a cell, ADR-003) but the model's estimate at a height, for the verdict. Always
 * Open-Meteo, like the weather field. Units: °C, km/h, mm/h, snowfall cm/h, heights m above sea level, probabilities
 * 0..1, Unix seconds. `null` means asked for and not given: never a zero.
 */
export type RouteWeatherHour = {
  time: number;
  /** Downscaled to the sample's height by the model: "stimata in quota" */
  temp: number | null;
  apparentTemp: number | null;
  condition: Condition | null;
  intensity: Intensity | null;
  precipitation: number | null;
  precipProbability: number | null;
  snowfall: number | null;
  /** At the model's ground height, not the summit's */
  windGust10m: number | null;
  /** The free-air wind at 700 hPa (about 3000 m): always an estimate */
  freeWind: number | null;
  freezingLevel: number | null;
  cape: number | null;
  lowCloud: number | null;
  /** km */
  visibility: number | null;
  isNight: boolean;
};

export type RouteWeatherSample = {
  lat: number;
  lon: number;
  /** The height asked for, m */
  ele: number;
  hours: RouteWeatherHour[];
  /** Sunrise and sunset of each day, Unix seconds */
  sun: { sunrise: number | null; sunset: number | null }[];
};

export type RouteWeather = {
  samples: RouteWeatherSample[];
  provenance: { source: "open-meteo" | "mock"; fetchedAt: number };
};
