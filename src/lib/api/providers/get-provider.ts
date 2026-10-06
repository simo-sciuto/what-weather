import "server-only";
import { createMockProvider, isMockScenario } from "./mock";
import { openWeatherProvider } from "./openweather";
import { openWeatherFreeProvider } from "./openweather-free";
import { openMeteoProvider } from "./openmeteo";
import type { WeatherProvider } from "./provider";

/**
 * OpenWeather One Call 4.0 when a key is configured, otherwise mock data.
 * WEATHER_PROVIDER picks explicitly: "openweather" (One Call 4.0, paid plan),
 * "openweather-free" (Current Weather + 3-hour Forecast), "open-meteo" (free,
 * non-commercial, no key) or "mock".
 * `scenario` and `at` (HH:MM) only affect the mock provider; in development a
 * valid scenario also forces it, so sample weather can be reviewed next to live data.
 */
export function getProvider(scenario?: string, at?: string): WeatherProvider {
  const reviewing = process.env.NODE_ENV !== "production" && isMockScenario(scenario);
  const name = reviewing
    ? "mock"
    : (process.env.WEATHER_PROVIDER ?? (process.env.OPENWEATHER_API_KEY ? "openweather" : "mock"));
  if (name === "openweather") return openWeatherProvider;
  if (name === "openweather-free") return openWeatherFreeProvider;
  if (name === "open-meteo") return openMeteoProvider;
  if (name === "mock") return createMockProvider(isMockScenario(scenario) ? scenario : undefined, at);
  throw new Error(`Unknown WEATHER_PROVIDER "${name}"`);
}
