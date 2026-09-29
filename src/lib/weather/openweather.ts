import "server-only";
import {
  COORD_PRECISION,
  GEOCODE_REVALIDATE_SECONDS,
  MAX_DATA_AGE_SECONDS,
  WEATHER_REVALIDATE_SECONDS,
} from "./constants";
import type { WeatherProvider } from "./provider";
import {
  toCurrent,
  toDaily,
  toHourly,
  toMinutes,
  toPlace,
  toAirQuality,
  toAlert,
  toQuarters,
  type OWAirPollution,
  type OWAlert,
  type OWCurrent,
  type OWDay,
  type OWEnvelope,
  type OWGeoPlace,
  type OWHour,
  type OWMinute,
} from "./transformers";
import type { AirQuality, Place, WeatherAlert, WeatherData } from "./types";

const ONECALL = "https://api.openweathermap.org/data/4.0/onecall";
const GEO = "https://api.openweathermap.org/geo/1.0";

/** Thrown for any upstream failure. Never carries the request URL (it contains the key). */
export class WeatherProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "WeatherProviderError";
  }
}

function apiKey(): string {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) throw new WeatherProviderError("OPENWEATHER_API_KEY is not set");
  return key;
}

/** `revalidate` in seconds; 0 skips the cache entirely. */
export async function get<T>(
  url: string,
  params: Record<string, string | number>,
  revalidate: number,
): Promise<T> {
  const search = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    appid: apiKey(),
  });
  const res = await fetch(
    `${url}?${search}`,
    revalidate > 0 ? { next: { revalidate } } : { cache: "no-store" },
  );
  if (!res.ok) {
    throw new WeatherProviderError(
      `OpenWeather ${new URL(url).pathname} responded ${res.status}`,
      res.status,
    );
  }
  return res.json() as Promise<T>;
}

export const round = (n: number) => Number(n.toFixed(COORD_PRECISION));

/**
 * Loads through the cache, but refetches when the cached reading is too old
 * to show (see MAX_DATA_AGE_SECONDS). `observedAt` returns the reading's time.
 */
export async function loadFresh<T>(
  load: (revalidate: number) => Promise<T>,
  observedAt: (result: T) => number | undefined,
): Promise<T> {
  const cached = await load(WEATHER_REVALIDATE_SECONDS);
  const at = observedAt(cached);
  if (at != null && Date.now() / 1000 - at <= MAX_DATA_AGE_SECONDS) return cached;
  return load(0);
}

function timeline<T>(path: string, lat: number, lon: number, revalidate: number) {
  return get<OWEnvelope<T>>(`${ONECALL}/${path}`, { lat, lon, units: "metric", lang: "en" }, revalidate);
}

/** Air Pollution API (free tier, all plans). Null when unavailable; never breaks the page. */
export async function lookupAirQuality(lat: number, lon: number): Promise<AirQuality | null> {
  try {
    const raw = await get<OWAirPollution>(
      "https://api.openweathermap.org/data/2.5/air_pollution",
      { lat, lon },
      WEATHER_REVALIDATE_SECONDS,
    );
    return toAirQuality(raw);
  } catch {
    return null;
  }
}

/** One Call lists active alerts by id; each one's text is a separate request. */
const MAX_ALERTS = 3;

async function lookupAlerts(ids: string[]): Promise<WeatherAlert[]> {
  const results = await Promise.all(
    ids.slice(0, MAX_ALERTS).map((id) =>
      get<OWAlert | OWEnvelope<OWAlert>>(`${ONECALL}/alert/${encodeURIComponent(id)}`, {}, WEATHER_REVALIDATE_SECONDS)
        .then((raw) => ("data" in raw ? raw.data[0] : raw))
        .then((raw) => (raw ? toAlert(raw) : null))
        .catch(() => null),
    ),
  );
  return results.filter((a): a is WeatherAlert => a !== null);
}

/** Name the place from coordinates; null when geocoding fails or finds nothing. */
export async function lookupPlace(lat: number, lon: number): Promise<Place | null> {
  try {
    const [hit] = await get<OWGeoPlace[]>(
      `${GEO}/reverse`,
      { lat, lon, limit: 1 },
      GEOCODE_REVALIDATE_SECONDS,
    );
    return hit ? { ...toPlace(hit), lat, lon } : null;
  } catch {
    return null;
  }
}

export const openWeatherProvider: WeatherProvider = {
  name: "openweather",

  async getByCoords(rawLat, rawLon) {
    const lat = round(rawLat);
    const lon = round(rawLon);

    const weather = (revalidate: number) =>
      Promise.all([
        timeline<OWCurrent>("current", lat, lon, revalidate),
        // Minute and 15-minute data are refinements; their absence must not break the page.
        timeline<OWMinute>("timeline/1min", lat, lon, revalidate).catch(() => null),
        timeline<OWHour>("timeline/15min", lat, lon, revalidate).catch(() => null),
        timeline<OWHour>("timeline/1h", lat, lon, revalidate),
        timeline<OWDay>("timeline/1day", lat, lon, revalidate),
      ]);

    const [[current, minutely, quarters, hourly, daily], place, airQuality] = await Promise.all([
      loadFresh(weather, ([c]) => c.data[0]?.dt),
      lookupPlace(lat, lon),
      lookupAirQuality(lat, lon),
    ]);

    const now = current.data[0];
    if (!now) throw new WeatherProviderError("OpenWeather returned no current data");
    const alerts = await lookupAlerts(now.alerts ?? []);

    return {
      place: place ?? { name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`, country: "", lat, lon },
      timezone: current.timezone,
      sunrise: now.sunrise,
      sunset: now.sunset,
      current: toCurrent(now),
      minutely: minutely?.data.length ? toMinutes(minutely.data) : null,
      quarterHourly: quarters?.data.length ? toQuarters(quarters.data) : null,
      hourly: toHourly(hourly.data),
      daily: toDaily(daily.data),
      airQuality,
      alerts,
    } satisfies WeatherData;
  },

  searchPlaces,
};

export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim();
  if (!q) return [];
  const hits = await get<OWGeoPlace[]>(`${GEO}/direct`, { q, limit: 5 }, GEOCODE_REVALIDATE_SECONDS);
  return hits.map(toPlace);
}
