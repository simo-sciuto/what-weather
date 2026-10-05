import type { DayPhase, WeatherState } from "@/types/sky";
import { hasSunTimes } from "./sun";
import { THRESHOLDS } from "@/constants/weather";
import type { CurrentWeather } from "@/types/weather";

export function dayPhase(now: number, sunrise: number, sunset: number, darkFallback = false): DayPhase {
  if (!hasSunTimes({ sunrise, sunset })) return darkFallback ? "night" : "day";
  const window = THRESHOLDS.twilightMinutes * 60;
  if (Math.abs(now - sunrise) <= window) return "dawn";
  if (Math.abs(now - sunset) <= window) return "dusk";
  return now > sunrise && now < sunset ? "day" : "night";
}

export function weatherState(current: Pick<CurrentWeather, "condition" | "intensity">, phase: DayPhase): WeatherState {
  switch (current.condition) {
    case "thunderstorm":
      return "STORM";
    case "snow":
      return "SNOW";
    case "fog":
      return "FOG";
    case "rain":
    case "drizzle":
      return current.intensity === "heavy" ? "HEAVY_RAIN" : "RAIN";
    case "cloudy":
      return "CLOUDY";
    case "partly-cloudy":
      return "PARTLY_CLOUDY";
    case "clear":
      return phase === "night" ? "CLEAR_NIGHT" : "CLEAR_DAY";
  }
}

/** Where the light source sits for a given light level and phase (see Frame.light). */
export function skyAt(light: number, phase: DayPhase): SkyPosition {
  if (phase === "night") return { body: "moon", elevation: 0.6, progress: 0.5 };
  return {
    body: "sun",
    elevation: Math.max(-0.25, Math.sin(Math.min(Math.max(light, -0.25), 1.25) * Math.PI)),
    progress: Math.min(Math.max(light, 0), 1),
  };
}

export type SkyPosition = {
  body: "sun" | "moon";
  /**
   * Height above the horizon: 1 at solar noon, 0 at sunrise/sunset, slightly
   * negative in twilight (the sun sits just below the horizon).
   */
  elevation: number;
  /** How far through the day, 0 at sunrise to 1 at sunset (clamped) */
  progress: number;
};
