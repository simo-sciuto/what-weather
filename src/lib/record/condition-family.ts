import type { Condition, Intensity } from "@/lib/weather/types";
import type { ConditionFamily } from "./types";

/** Wind takes over a clear or cloudy record from this speed, or this gust, in km/h */
export const WIND_SPEED = 40;
export const WIND_GUST = 60;

const BY_CONDITION: Record<Condition, ConditionFamily> = {
  clear: "CLEAR",
  "partly-cloudy": "CLOUD",
  cloudy: "CLOUD",
  fog: "FOG",
  drizzle: "RAIN",
  rain: "RAIN",
  thunderstorm: "STORM",
  snow: "SNOW",
};

/**
 * The one mapping from the project's normalized condition (providers' codes never get this far, ADR-001) to the
 * family the composition reads. Wind is not a condition: it takes over only where nothing falls from the sky.
 */
export function conditionFamily(input: {
  condition: Condition;
  intensity?: Intensity;
  windSpeed?: number;
  windGust?: number;
}): ConditionFamily {
  const family = BY_CONDITION[input.condition];
  const windy = (input.windSpeed ?? 0) >= WIND_SPEED || (input.windGust ?? 0) >= WIND_GUST;
  if (windy && (family === "CLEAR" || family === "CLOUD")) return "WIND";
  return family;
}
