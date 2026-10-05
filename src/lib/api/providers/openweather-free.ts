import "server-only";
import {
  WeatherProviderError,
  get,
  loadFresh,
  lookupAirQuality,
  lookupPlace,
  round,
  searchPlaces,
} from "./openweather";
import type { WeatherProvider } from "./provider";
import {
  offsetToZone,
  toCurrent25,
  toDailyFromForecast,
  toForecastPoints,
  type OW25Current,
  type OW25Forecast,
} from "./openweather-transformers";
import { localDay } from "@/lib/weather/formatters";
import type { CurrentWeather, DailyPoint, WeatherData } from "@/lib/weather/types";

/** The forecast starts at the next 3-hour slot; fold the current reading into today. */
function includeNow(days: DailyPoint[], now: CurrentWeather, timeZone: string): DailyPoint[] {
  const [first, ...rest] = days;
  if (!first || localDay(first.time, timeZone) !== localDay(now.time, timeZone)) return days;
  return [{ ...first, min: Math.min(first.min, now.temp), max: Math.max(first.max, now.temp) }, ...rest];
}

const API = "https://api.openweathermap.org/data/2.5";

/**
 * OpenWeather's free tier: Current Weather + 5 day / 3 hour Forecast.
 * Coarser than One Call — no minute precipitation, no UV, no moon, no alerts,
 * 3-hour steps — so those parts of the model are left empty rather than faked.
 */
export const openWeatherFreeProvider: WeatherProvider = {
  name: "openweather-free",

  async getByCoords(rawLat, rawLon) {
    const lat = round(rawLat);
    const lon = round(rawLon);
    const params = { lat, lon, units: "metric", lang: "en" };

    const weather = (revalidate: number) =>
      Promise.all([
        get<OW25Current>(`${API}/weather`, params, revalidate),
        get<OW25Forecast>(`${API}/forecast`, params, revalidate),
      ]);

    const [[current, forecast], place, airQuality] = await Promise.all([
      loadFresh(weather, ([c]) => c.dt),
      lookupPlace(lat, lon),
      lookupAirQuality(lat, lon),
    ]);
    if (!current.main) throw new WeatherProviderError("OpenWeather returned no current data");

    const timezone = offsetToZone(current.timezone);
    const current25 = toCurrent25(current);
    // The forecast list starts at the next 3-hour slot, but guard against stale entries.
    const upcoming = forecast.list.filter((f) => f.dt > current.dt - 1800);

    return {
      // Current Weather names its nearest station area; good enough as a fallback.
      place: place ?? {
        name: current.name || `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
        country: current.sys.country ?? "",
        lat,
        lon,
      },
      timezone,
      sunrise: current.sys.sunrise,
      sunset: current.sys.sunset,
      current: current25,
      minutely: null,
      quarterHourly: null,
      hourly: toForecastPoints(upcoming),
      daily: includeNow(toDailyFromForecast(upcoming, timezone), current25, timezone),
      airQuality,
      // The free tier carries no official alerts.
      alerts: [],
    } satisfies WeatherData;
  },

  searchPlaces,
};
