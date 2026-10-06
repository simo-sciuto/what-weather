import type { Place, WeatherData } from "@/types/weather";

/**
 * Every weather API (OpenWeather, Open-Meteo, ...) gets its own adapter that
 * maps the raw response onto `WeatherData`. Components never see raw payloads.
 */
export type WeatherProvider = {
  readonly name: "openweather" | "openweather-free" | "open-meteo" | "mock";
  getByCoords(lat: number, lon: number): Promise<WeatherData>;
  searchPlaces(query: string): Promise<Place[]>;
};
