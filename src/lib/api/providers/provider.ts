import type { Place, WeatherData } from "@/types/weather";

/**
 * The weather of a place at a past moment, as a model's reconstruction (WTH-168, ADR-013). Its `WeatherData` is
 * the same one the timeline takes: `current` is the hour asked for, `hourly` the hours after it, and
 * `reconstruction` says what it is. Apart from `WeatherProvider`: it does not know the present.
 */
export interface HistoricalProvider {
  readonly name: "open-meteo-archive";
  /** `at` in Unix seconds, taken to the nearest hour; `place` names the coordinates when the caller knows them */
  getAt(lat: number, lon: number, at: number, place?: Place): Promise<WeatherData>;
}

/**
 * Every weather API (OpenWeather, Open-Meteo, ...) gets its own adapter that
 * maps the raw response onto `WeatherData`. Components never see raw payloads.
 */
export type WeatherProvider = {
  readonly name: "openweather" | "openweather-free" | "open-meteo" | "mock";
  getByCoords(lat: number, lon: number): Promise<WeatherData>;
  searchPlaces(query: string): Promise<Place[]>;
};
