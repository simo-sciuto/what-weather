import "server-only";
import { FIELD_REVALIDATE_SECONDS, MAX_DATA_AGE_SECONDS, WEATHER_STALE_SECONDS } from "@/constants/cache";
import { WeatherProviderError } from "@/lib/api/providers/openweather";
import { mapCode } from "@/lib/api/providers/openmeteo";
import type { RouteWeather, RouteWeatherHour, RouteWeatherSample } from "@/types/route";
import { cacheLife } from "next/cache";

/**
 * The weather at given heights (ADR-031, docs/VERDICT.md): one Open-Meteo request for every sample, each with the
 * height asked for (`elevation`), so the temperature is the model's estimate at that height. Always Open-Meteo, like
 * the weather field: the variables the verdict needs (freezing level, CAPE, the free-air wind) are not in `WeatherData`.
 * A missing value stays `null`, never a zero.
 */

export const HOURLY = [
  "temperature_2m",
  "apparent_temperature",
  "precipitation",
  "precipitation_probability",
  "snowfall",
  "weather_code",
  "wind_gusts_10m",
  "wind_speed_700hPa",
  "freezing_level_height",
  "cape",
  "cloud_cover_low",
  "visibility",
  "is_day",
] as const;

export type Spot = { lat: number; lon: number; ele: number };

type Series = { time?: number[] } & Partial<Record<(typeof HOURLY)[number], (number | null)[]>>;
type Raw = { hourly?: Series; daily?: { sunrise?: (number | null)[]; sunset?: (number | null)[] } };

const num = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** One sample as Open-Meteo answered it */
export function parseSample(raw: Raw, spot: Spot): RouteWeatherSample {
  const h = raw.hourly;
  if (!h?.time?.length) throw new WeatherProviderError("Open-Meteo gave no hours for the spot");
  const hours: RouteWeatherHour[] = h.time.map((time, i) => {
    const code = num(h.weather_code?.[i]);
    const mapped = code === null ? null : mapCode(code);
    const vis = num(h.visibility?.[i]);
    const day = num(h.is_day?.[i]);
    return {
      time,
      temp: num(h.temperature_2m?.[i]),
      apparentTemp: num(h.apparent_temperature?.[i]),
      condition: mapped?.condition ?? null,
      intensity: mapped?.intensity ?? null,
      precipitation: num(h.precipitation?.[i]),
      precipProbability: num(h.precipitation_probability?.[i]) === null ? null : num(h.precipitation_probability?.[i])! / 100,
      snowfall: num(h.snowfall?.[i]),
      windGust10m: num(h.wind_gusts_10m?.[i]),
      freeWind: num(h.wind_speed_700hPa?.[i]),
      freezingLevel: num(h.freezing_level_height?.[i]),
      cape: num(h.cape?.[i]),
      lowCloud: num(h.cloud_cover_low?.[i]),
      // Open-Meteo gives metres; the project speaks km
      visibility: vis === null ? null : vis / 1000,
      isNight: day === 0,
    };
  });
  const sunrise = raw.daily?.sunrise ?? [];
  const sun = sunrise.map((r, i) => ({ sunrise: num(r), sunset: num(raw.daily?.sunset?.[i]) }));
  return { ...spot, hours, sun };
}

/** The weather of the spots, three days of hours; no cache here (see `spotWeather`) */
export async function fetchRouteWeather(spots: Spot[], fetchImpl: typeof fetch = fetch): Promise<RouteWeather> {
  const params = new URLSearchParams({
    latitude: spots.map((s) => s.lat).join(","),
    longitude: spots.map((s) => s.lon).join(","),
    elevation: spots.map((s) => Math.round(s.ele)).join(","),
    hourly: HOURLY.join(","),
    daily: "sunrise,sunset",
    forecast_days: "3",
    timeformat: "unixtime",
    timezone: "GMT",
  });
  const res = await fetchImpl(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new WeatherProviderError(`Open-Meteo spot responded ${res.status}`, res.status);
  const body: unknown = await res.json();
  const raws = (Array.isArray(body) ? body : [body]) as Raw[];
  if (raws.length !== spots.length) throw new WeatherProviderError("Open-Meteo spot answer is incomplete");
  return { samples: raws.map((r, i) => parseSample(r, spots[i])), provenance: { source: "open-meteo", fetchedAt: Math.floor(Date.now() / 1000) } };
}

/** A summit's weather through the shared cache, keyed on its rounded point and a 100 m band of height */
export async function spotWeather(lat: number, lon: number, ele: number): Promise<RouteWeather> {
  "use cache";
  cacheLife({ revalidate: FIELD_REVALIDATE_SECONDS, stale: WEATHER_STALE_SECONDS, expire: MAX_DATA_AGE_SECONDS });
  return fetchRouteWeather([{ lat, lon, ele }]);
}

/** Sample weather for a spot (tests, a machine with no provider): a fine morning turning stormy in the afternoon, colder higher up */
export function sampleSpot(spot: Spot): RouteWeather {
  const start = Math.floor(Date.now() / 3_600_000) * 3600;
  const hours: RouteWeatherHour[] = Array.from({ length: 72 }, (_, i) => {
    const time = start + i * 3600;
    const hour = new Date(time * 1000).getUTCHours();
    const afternoon = hour >= 13 && hour <= 16;
    return {
      time,
      temp: 18 - spot.ele * 0.0065,
      apparentTemp: 16 - spot.ele * 0.0065,
      condition: afternoon ? "thunderstorm" : "clear",
      intensity: "moderate",
      precipitation: afternoon ? 2 : 0,
      precipProbability: afternoon ? 0.6 : 0.05,
      snowfall: 0,
      windGust10m: 25,
      freeWind: 20,
      freezingLevel: 3600,
      cape: afternoon ? 900 : 100,
      lowCloud: 10,
      visibility: 30,
      isNight: hour < 5 || hour > 18,
    };
  });
  return { samples: [{ ...spot, hours, sun: [] }], provenance: { source: "mock", fetchedAt: start } };
}
