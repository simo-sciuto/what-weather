import "server-only";
import { GEOCODE_REVALIDATE_SECONDS, WEATHER_REVALIDATE_SECONDS, isWet } from "./constants";
import { airIndexOf } from "./details";
import { WeatherProviderError, loadFresh, lookupPlace, round } from "./openweather";
import type { WeatherProvider } from "./provider";
import { regionName } from "./regions";
import type { AirQuality, Condition, CurrentWeather, DailyPoint, HourlyPoint, Intensity, Place, QuarterPoint, WeatherData } from "./types";

/**
 * Open-Meteo (https://open-meteo.com), free for non-commercial use, no key.
 * Hourly steps, 8 days, UV, 15-minute precipitation, air quality and Italian
 * place names. It has no reverse geocoding (OpenWeather's is used when a key
 * is set) and no official alerts. Its licence (CC BY 4.0) asks for credit,
 * which the page footer gives.
 */

const FORECAST = "https://api.open-meteo.com/v1/forecast";
const AIR = "https://air-quality-api.open-meteo.com/v1/air-quality";
const GEOCODING = "https://geocoding-api.open-meteo.com/v1/search";

/** As many days as the week chapter shows (see days.ts). */
const FORECAST_DAYS = 8;
/** 15-minute precipitation for the next 6 hours, to time rain and show how hard it falls. */
const QUARTERS = 24;

const CURRENT = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "dew_point_2m",
  "is_day",
  "precipitation",
  "weather_code",
  "cloud_cover",
  "pressure_msl",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "visibility",
  "uv_index",
] as const;
const HOURLY = [
  "temperature_2m",
  "apparent_temperature",
  "precipitation_probability",
  "precipitation",
  "weather_code",
  "cloud_cover",
  "pressure_msl",
  "wind_speed_10m",
  "wind_gusts_10m",
  "uv_index",
  "is_day",
] as const;
const DAILY = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_probability_max",
  "uv_index_max",
  "wind_gusts_10m_max",
  "sunrise",
  "sunset",
] as const;
const POLLUTANTS = ["pm10", "pm2_5", "carbon_monoxide", "nitrogen_dioxide", "sulphur_dioxide", "ozone"] as const;

/* ---------- Raw payloads (timeformat=unixtime, km/h, °C, hPa, m) ---------- */

type Series<K extends string> = { time: number[] } & Record<K, (number | null)[]>;

interface OMForecast {
  timezone: string;
  current: { time: number; interval: number } & Record<(typeof CURRENT)[number], number | null>;
  minutely_15?: Series<"precipitation" | "weather_code">;
  hourly: Series<(typeof HOURLY)[number]>;
  daily: Series<(typeof DAILY)[number]>;
}

interface OMAir {
  current?: { time: number } & Record<(typeof POLLUTANTS)[number], number | null>;
}

interface OMGeoResult {
  name: string;
  latitude: number;
  longitude: number;
  country_code?: string;
  admin1?: string;
}

async function get<T>(url: string, params: Record<string, string | number>, revalidate: number): Promise<T> {
  const res = await fetch(
    `${url}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`,
    revalidate > 0 ? { next: { revalidate } } : { cache: "no-store" },
  );
  if (!res.ok) throw new WeatherProviderError(`Open-Meteo ${new URL(url).pathname} responded ${res.status}`, res.status);
  return res.json() as Promise<T>;
}

/* ---------- Mapping ---------- */

/** WMO weather interpretation codes, https://open-meteo.com/en/docs */
function mapCode(code: number): { condition: Condition; intensity: Intensity; description: string } {
  const c = (condition: Condition, intensity: Intensity, description: string) => ({ condition, intensity, description });
  switch (code) {
    case 0:
      return c("clear", "moderate", "Clear sky");
    case 1:
      return c("clear", "moderate", "Mainly clear");
    case 2:
      return c("partly-cloudy", "moderate", "Partly cloudy");
    case 3:
      return c("cloudy", "moderate", "Overcast");
    case 45:
    case 48:
      return c("fog", "moderate", "Fog");
    case 51:
      return c("drizzle", "light", "Light drizzle");
    case 53:
      return c("drizzle", "moderate", "Drizzle");
    case 55:
      return c("drizzle", "heavy", "Dense drizzle");
    case 56:
    case 57:
      return c("drizzle", code === 57 ? "heavy" : "light", "Freezing drizzle");
    case 61:
      return c("rain", "light", "Light rain");
    case 63:
      return c("rain", "moderate", "Rain");
    case 65:
      return c("rain", "heavy", "Heavy rain");
    // Freezing rain falls with snow, as OpenWeather's adapter has it.
    case 66:
    case 67:
      return c("snow", code === 67 ? "heavy" : "light", "Freezing rain");
    case 71:
      return c("snow", "light", "Light snow");
    case 73:
      return c("snow", "moderate", "Snow");
    case 75:
      return c("snow", "heavy", "Heavy snow");
    case 77:
      return c("snow", "light", "Snow grains");
    case 80:
      return c("rain", "light", "Light showers");
    case 81:
      return c("rain", "moderate", "Showers");
    case 82:
      return c("rain", "heavy", "Violent showers");
    case 85:
      return c("snow", "light", "Snow showers");
    case 86:
      return c("snow", "heavy", "Heavy snow showers");
    case 95:
      return c("thunderstorm", "moderate", "Thunderstorm");
    case 96:
    case 99:
      return c("thunderstorm", "heavy", "Thunderstorm with hail");
    default:
      return c("cloudy", "moderate", "Cloudy");
  }
}

const num = (v: number | null | undefined, fallback = 0) => (v == null ? fallback : v);
const optional = (v: number | null | undefined) => (v == null ? undefined : v);

function toCurrent(raw: OMForecast["current"]): CurrentWeather {
  const { condition, intensity, description } = mapCode(num(raw.weather_code));
  return {
    time: raw.time,
    temp: num(raw.temperature_2m),
    feelsLike: num(raw.apparent_temperature, num(raw.temperature_2m)),
    condition,
    intensity,
    description,
    uvIndex: optional(raw.uv_index),
    windSpeed: num(raw.wind_speed_10m),
    windGust: optional(raw.wind_gusts_10m),
    windDeg: num(raw.wind_direction_10m),
    humidity: num(raw.relative_humidity_2m),
    pressure: num(raw.pressure_msl),
    dewPoint: num(raw.dew_point_2m),
    cloudCover: num(raw.cloud_cover),
    visibility: num(raw.visibility) / 1000,
    // The amount fell over the current interval (15 minutes); the model wants a rate.
    precipitation: num(raw.precipitation) * (3600 / (raw.interval || 3600)),
  };
}

/** Hours from the current one on (the series starts at midnight). */
function toHourly(raw: OMForecast["hourly"], now: number): HourlyPoint[] {
  return raw.time.flatMap((time, i) => {
    if (time <= now - 1800) return [];
    const { condition, intensity } = mapCode(num(raw.weather_code[i]));
    return [
      {
        time,
        temp: num(raw.temperature_2m[i]),
        feelsLike: num(raw.apparent_temperature[i], num(raw.temperature_2m[i])),
        condition,
        intensity,
        isNight: raw.is_day[i] === 0,
        precipProbability: num(raw.precipitation_probability[i]) / 100,
        precipitation: num(raw.precipitation[i]),
        windSpeed: num(raw.wind_speed_10m[i]),
        windGust: optional(raw.wind_gusts_10m[i]),
        uvIndex: optional(raw.uv_index[i]),
        pressure: num(raw.pressure_msl[i]),
        cloudCover: num(raw.cloud_cover[i]),
      },
    ];
  });
}

/**
 * The day's sky as it mostly looks by day. Open-Meteo's daily code is the
 * day's worst hour, so a single overcast hour turns a sunny day grey; here
 * precipitation wins only when it lasts (2+ daylight hours), otherwise the
 * most frequent sky does. Falls back to the daily code without hours.
 */
function daySky(hourly: OMForecast["hourly"], from: number, to: number, fallback: number) {
  const codes = hourly.time.flatMap((t, i) => (t >= from && t < to && hourly.is_day[i] === 1 ? [num(hourly.weather_code[i])] : []));
  if (!codes.length) return mapCode(fallback);
  const skies = codes.map(mapCode);
  const wet = skies.filter((k) => isWet(k.condition));
  const dry = skies.filter((k) => !isWet(k.condition));
  const pool = wet.length >= 2 || !dry.length ? wet : dry;
  const count = (k: { condition: Condition }) => pool.filter((p) => p.condition === k.condition).length;
  // Most frequent condition; among its hours, the strongest intensity.
  const top = pool.reduce((a, b) => (count(b) > count(a) ? b : a));
  const rank = { light: 0, moderate: 1, heavy: 2 } as const;
  return pool.filter((k) => k.condition === top.condition).reduce((a, b) => (rank[b.intensity] > rank[a.intensity] ? b : a));
}

/** Whole calendar days in the place's time zone, today included in full. */
function toDaily(raw: OMForecast["daily"], hourly: OMForecast["hourly"]): DailyPoint[] {
  return raw.time.map((time, i) => {
    const { condition, intensity } = daySky(hourly, time, raw.time[i + 1] ?? time + 86400, num(raw.weather_code[i]));
    return {
      time,
      min: num(raw.temperature_2m_min[i]),
      max: num(raw.temperature_2m_max[i]),
      condition,
      intensity,
      precipProbability: num(raw.precipitation_probability_max[i]) / 100,
      uvIndex: optional(raw.uv_index_max[i]),
      windGust: optional(raw.wind_gusts_10m_max[i]),
      sunrise: optional(raw.sunrise[i]),
      sunset: optional(raw.sunset[i]),
      // No moon data: the details work the phase out themselves.
    };
  });
}

/** 15-minute steps from now; amounts per step become rates, the chance comes from the hour. */
function toQuarters(raw: OMForecast["minutely_15"], hourly: HourlyPoint[], now: number): QuarterPoint[] | null {
  if (!raw?.time.length) return null;
  const chance = (t: number) => hourly.find((h) => h.time <= t && t < h.time + 3600)?.precipProbability ?? 0;
  const points = raw.time.flatMap((time, i) =>
    time < now - 900
      ? []
      : [
          {
            time,
            condition: mapCode(num(raw.weather_code[i])).condition,
            precipProbability: chance(time),
            precipitation: num(raw.precipitation[i]) * 4,
          },
        ],
  );
  return points.length ? points : null;
}

/** Air quality, keyed to the page's 1–5 scale from the concentrations. Null when unavailable; never breaks the page. */
async function lookupAirQuality(lat: number, lon: number): Promise<AirQuality | null> {
  try {
    const raw = await get<OMAir>(
      AIR,
      { latitude: lat, longitude: lon, timeformat: "unixtime", current: POLLUTANTS.join(",") },
      WEATHER_REVALIDATE_SECONDS,
    );
    const c = raw.current;
    if (!c || c.pm2_5 == null || c.pm10 == null) return null;
    const pollutants = {
      pm2_5: c.pm2_5,
      pm10: c.pm10,
      o3: num(c.ozone),
      no2: num(c.nitrogen_dioxide),
      so2: num(c.sulphur_dioxide),
      co: num(c.carbon_monoxide),
    };
    return { time: c.time, index: airIndexOf(pollutants), pollutants };
  } catch {
    return null;
  }
}

async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim();
  if (!q) return [];
  const { results = [] } = await get<{ results?: OMGeoResult[] }>(
    GEOCODING,
    { name: q, count: 5, language: "it", format: "json" },
    GEOCODE_REVALIDATE_SECONDS,
  );
  return results.map((r) => ({
    name: r.name,
    region: regionName(r.admin1),
    country: r.country_code ?? "",
    lat: r.latitude,
    lon: r.longitude,
  }));
}

export const openMeteoProvider: WeatherProvider = {
  name: "open-meteo",

  async getByCoords(rawLat, rawLon) {
    const lat = round(rawLat);
    const lon = round(rawLon);

    const weather = (revalidate: number) =>
      get<OMForecast>(
        FORECAST,
        {
          latitude: lat,
          longitude: lon,
          timezone: "auto",
          timeformat: "unixtime",
          forecast_days: FORECAST_DAYS,
          forecast_minutely_15: QUARTERS,
          current: CURRENT.join(","),
          hourly: HOURLY.join(","),
          daily: DAILY.join(","),
          minutely_15: "precipitation,weather_code",
        },
        revalidate,
      );

    const [forecast, place, airQuality] = await Promise.all([
      loadFresh(weather, (f) => f.current?.time),
      // Open-Meteo can't name coordinates; OpenWeather's reverse geocoding does when a key is set.
      lookupPlace(lat, lon),
      lookupAirQuality(lat, lon),
    ]);
    if (!forecast.current) throw new WeatherProviderError("Open-Meteo returned no current data");

    const current = toCurrent(forecast.current);
    const hourly = toHourly(forecast.hourly, current.time);
    const daily = toDaily(forecast.daily, forecast.hourly);
    const today = daily[0];

    return {
      place: place ?? { name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`, country: "", lat, lon },
      timezone: forecast.timezone,
      sunrise: today?.sunrise ?? 0,
      sunset: today?.sunset ?? 0,
      current,
      minutely: null,
      quarterHourly: toQuarters(forecast.minutely_15, hourly, current.time),
      hourly,
      daily,
      airQuality,
      // Open-Meteo carries no official alerts.
      alerts: [],
    } satisfies WeatherData;
  },

  searchPlaces,
};
