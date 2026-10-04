import { atmosphericData, estimatedDewPoint } from "./atmospheric-data";
import { localDay } from "./formatters";
import { regionName } from "./regions";
import { isWet } from "./constants";
import type {
  AirQuality,
  Condition,
  CurrentWeather,
  DailyPoint,
  HourlyPoint,
  Intensity,
  MinutePoint,
  Place,
  QuarterPoint,
  WeatherAlert,
} from "./types";

/* ---------- Raw OpenWeather One Call 4.0 / Geocoding shapes ---------- */

interface OWCondition {
  id: number;
  main: string;
  description: string;
  icon: string;
}

interface OWPrecip {
  "1h"?: number;
}

export interface OWEnvelope<T> {
  lat: number;
  lon: number;
  timezone: string;
  timezone_offset: number;
  data: T[];
}

export interface OWCurrent {
  dt: number;
  sunrise: number;
  sunset: number;
  temp: number;
  feels_like: number;
  pressure: number;
  humidity: number;
  dew_point: number;
  uvi: number;
  clouds: number;
  visibility?: number;
  wind_speed: number;
  wind_deg: number;
  wind_gust?: number;
  rain?: OWPrecip;
  snow?: OWPrecip;
  weather: OWCondition[];
  alerts?: string[];
}

export interface OWMinute {
  dt: number;
  precipitation: number;
}

export interface OWHour extends Omit<OWCurrent, "sunrise" | "sunset"> {
  pop: number;
}

export interface OWDay {
  dt: number;
  sunrise?: number;
  sunset?: number;
  moonrise?: number;
  moonset?: number;
  moon_phase?: number;
  temp: { min: number; max: number };
  uvi: number;
  wind_gust?: number;
  pop: number;
  weather: OWCondition[];
}

export interface OWGeoPlace {
  name: string;
  local_names?: Record<string, string>;
  state?: string;
  country: string;
  lat: number;
  lon: number;
}

/* ---------- Mapping ---------- */

/** Requests use units=metric, so wind arrives in m/s. */
const msToKmh = (ms: number) => ms * 3.6;
const optionalKmh = (ms?: number) => (ms == null ? undefined : msToKmh(ms));

/** https://openweathermap.org/weather-conditions */
function mapCondition(
  id: number,
  clouds?: number,
): { condition: Condition; intensity: Intensity } {
  const group = Math.floor(id / 100);
  const heavy = [202, 212, 221, 232, 502, 503, 504, 522, 531, 602, 622, 314];
  const light = [200, 210, 230, 300, 310, 500, 520, 600, 615, 620];
  const intensity: Intensity = heavy.includes(id)
    ? "heavy"
    : light.includes(id)
      ? "light"
      : "moderate";

  if (group === 2) return { condition: "thunderstorm", intensity };
  if (group === 3) return { condition: "drizzle", intensity };
  if (id === 511) return { condition: "snow", intensity }; // freezing rain
  if (group === 5) return { condition: "rain", intensity };
  if (group === 6) return { condition: "snow", intensity };
  if (group === 7) return { condition: "fog", intensity };
  if (id === 800) return { condition: "clear", intensity };
  if (id === 801 || id === 802) {
    // A few clouds on an otherwise clear sky still reads as clear.
    return {
      condition: clouds != null && clouds < 20 ? "clear" : "partly-cloudy",
      intensity,
    };
  }
  return { condition: "cloudy", intensity };
}

function describe(weather: OWCondition[] | undefined): string {
  const text = weather?.[0]?.description ?? "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const precipOf = (p: { rain?: OWPrecip; snow?: OWPrecip }) =>
  (p.rain?.["1h"] ?? 0) + (p.snow?.["1h"] ?? 0);

export function toCurrent(raw: OWCurrent): CurrentWeather {
  const atmosphere = atmosphericData({ humidity: raw.humidity, dewPoint: raw.dew_point, visibility: raw.visibility == null ? undefined : raw.visibility / 1000 }, "provider");
  return {
    time: raw.dt,
    temp: raw.temp,
    feelsLike: raw.feels_like,
    ...mapCondition(raw.weather[0]?.id ?? 800, raw.clouds),
    description: describe(raw.weather),
    uvIndex: raw.uvi,
    windSpeed: msToKmh(raw.wind_speed),
    windGust: optionalKmh(raw.wind_gust),
    windDeg: raw.wind_deg,
    atmosphericSources: atmosphere.atmosphericSources,
    humidity: atmosphere.humidity ?? 0,
    pressure: raw.pressure,
    dewPoint: atmosphere.dewPoint ?? 0,
    cloudCover: raw.clouds,
    visibility: atmosphere.visibility ?? 10,
    precipitation: precipOf(raw),
  };
}

export function toMinutes(raw: OWMinute[]): MinutePoint[] {
  return raw.map((m) => ({ time: m.dt, precipitation: m.precipitation }));
}

export function toQuarters(raw: OWHour[]): QuarterPoint[] {
  return raw.map((q) => ({
    time: q.dt,
    condition: mapCondition(q.weather[0]?.id ?? 800, q.clouds).condition,
    precipProbability: q.pop,
    precipitation: precipOf(q),
  }));
}

export function toHourly(raw: OWHour[]): HourlyPoint[] {
  return raw.map((h) => ({
    ...atmosphericData({ humidity: h.humidity, dewPoint: h.dew_point, visibility: h.visibility == null ? undefined : h.visibility / 1000 }, "provider"),
    time: h.dt,
    temp: h.temp,
    feelsLike: h.feels_like,
    ...mapCondition(h.weather[0]?.id ?? 800, h.clouds),
    // OpenWeather icon codes end in "n" for night hours.
    isNight: h.weather[0]?.icon.endsWith("n") ?? false,
    precipProbability: h.pop,
    precipitation: precipOf(h),
    windSpeed: msToKmh(h.wind_speed),
    windGust: optionalKmh(h.wind_gust),
    uvIndex: h.uvi,
    pressure: h.pressure,
    cloudCover: h.clouds,
  }));
}

export function toDaily(raw: OWDay[]): DailyPoint[] {
  return raw.map((d) => ({
    time: d.dt,
    min: d.temp.min,
    max: d.temp.max,
    ...mapCondition(d.weather[0]?.id ?? 800),
    precipProbability: d.pop,
    uvIndex: d.uvi,
    windGust: optionalKmh(d.wind_gust),
    sunrise: d.sunrise,
    sunset: d.sunset,
    moonrise: d.moonrise,
    moonset: d.moonset,
    moonPhase: d.moon_phase,
  }));
}

export function toPlace(raw: OWGeoPlace): Place {
  return {
    name: raw.local_names?.it ?? raw.local_names?.en ?? raw.name,
    region: regionName(raw.state),
    country: raw.country,
    lat: raw.lat,
    lon: raw.lon,
  };
}

/* ---------- Free APIs: Current Weather + 5 day / 3 hour Forecast (2.5) ---------- */

interface OW25Main {
  temp: number;
  feels_like: number;
  temp_min: number;
  temp_max: number;
  pressure: number;
  humidity: number;
  dew_point?: number;
}

interface OW25Wind {
  speed: number;
  deg: number;
  gust?: number;
}

export interface OW25Current {
  dt: number;
  name: string;
  timezone: number;
  main: OW25Main;
  weather: OWCondition[];
  wind: OW25Wind;
  clouds: { all: number };
  visibility?: number;
  rain?: OWPrecip;
  snow?: OWPrecip;
  sys: { country?: string; sunrise: number; sunset: number };
}

export interface OW25ForecastItem {
  dt: number;
  main: OW25Main;
  weather: OWCondition[];
  wind: OW25Wind;
  clouds: { all: number };
  visibility?: number;
  pop: number;
  rain?: { "3h"?: number };
  snow?: { "3h"?: number };
  sys: { pod: "d" | "n" };
}

export interface OW25Forecast {
  list: OW25ForecastItem[];
  city: { timezone: number };
}

/**
 * A fixed UTC offset as an Intl time zone. Whole hours become IANA names
 * (7200 → "Etc/GMT-2", whose sign is inverted by convention), which every
 * Node accepts; the rare half-hour offsets (India, +05:30) stay as "+05:30",
 * which Intl accepts from Node 22.
 */
export function offsetToZone(seconds: number): string {
  if (seconds === 0) return "UTC";
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return `Etc/GMT${hours > 0 ? "-" : "+"}${Math.abs(hours)}`;
  }
  const sign = seconds < 0 ? "-" : "+";
  const abs = Math.abs(seconds);
  const hh = String(Math.floor(abs / 3600)).padStart(2, "0");
  const mm = String(Math.floor((abs % 3600) / 60)).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

function atmosphere25(raw: Pick<OW25Current, "main" | "visibility">) {
  const supplied = atmosphericData({ humidity: raw.main.humidity, dewPoint: raw.main.dew_point, visibility: raw.visibility == null ? undefined : raw.visibility / 1000 }, "provider");
  if (supplied.dewPoint == null && supplied.humidity != null) {
    const estimate = estimatedDewPoint(raw.main.temp, supplied.humidity);
    if (estimate != null) {
      supplied.dewPoint = estimate;
      supplied.atmosphericSources!.dewPoint = "estimated";
    }
  }
  return supplied;
}

export function toCurrent25(raw: OW25Current): CurrentWeather {
  const atmosphere = atmosphere25(raw);
  return {
    time: raw.dt,
    temp: raw.main.temp,
    feelsLike: raw.main.feels_like,
    ...mapCondition(raw.weather[0]?.id ?? 800, raw.clouds.all),
    description: describe(raw.weather),
    windSpeed: msToKmh(raw.wind.speed),
    windGust: optionalKmh(raw.wind.gust),
    windDeg: raw.wind.deg,
    atmosphericSources: atmosphere.atmosphericSources,
    humidity: atmosphere.humidity ?? 0,
    pressure: raw.main.pressure,
    dewPoint: atmosphere.dewPoint ?? 0,
    cloudCover: raw.clouds.all,
    visibility: atmosphere.visibility ?? 10,
    precipitation: precipOf(raw),
  };
}

export function toForecastPoints(raw: OW25ForecastItem[]): HourlyPoint[] {
  return raw.map((f) => ({
    ...atmosphere25(f),
    time: f.dt,
    temp: f.main.temp,
    feelsLike: f.main.feels_like,
    ...mapCondition(f.weather[0]?.id ?? 800, f.clouds.all),
    isNight: f.sys.pod === "n",
    precipProbability: f.pop,
    // 3-hour accumulations, expressed per hour like everywhere else.
    precipitation: ((f.rain?.["3h"] ?? 0) + (f.snow?.["3h"] ?? 0)) / 3,
    windSpeed: msToKmh(f.wind.speed),
    windGust: optionalKmh(f.wind.gust),
    pressure: f.main.pressure,
    cloudCover: f.clouds.all,
  }));
}


/**
 * Daily summaries built from 3-hour steps. Days the forecast only partly
 * covers (today, and the last day) are flagged `partial`.
 */
export function toDailyFromForecast(raw: OW25ForecastItem[], timeZone: string): DailyPoint[] {
  const dayOf = (ts: number) => localDay(ts, timeZone);

  const groups = new Map<string, OW25ForecastItem[]>();
  for (const item of raw) {
    const key = dayOf(item.dt);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return [...groups.values()].map((items) => {
    const points = toForecastPoints(items);
    const daytime = points.filter((p) => !p.isNight);
    const pool = daytime.length ? daytime : points;
    // A likely wet spell defines the day; otherwise the most common daytime sky.
    const wet = pool.find((p) => isWet(p.condition) && p.precipProbability >= 0.5);
    const counts = new Map<Condition, number>();
    for (const p of pool) counts.set(p.condition, (counts.get(p.condition) ?? 0) + 1);
    const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const sky = wet ?? pool.find((p) => p.condition === common)!;
    const gusts = points.map((p) => p.windGust).filter((g): g is number => g != null);

    return {
      time: items[Math.floor(items.length / 2)].dt,
      // The slot temperatures, as the hourly curve shows them: the forecast's
      // temp_min/temp_max spread across the city area and run degrees wide of them.
      min: Math.min(...items.map((i) => i.main.temp)),
      max: Math.max(...items.map((i) => i.main.temp)),
      condition: sky.condition,
      intensity: sky.intensity,
      precipProbability: Math.max(...points.map((p) => p.precipProbability)),
      windGust: gusts.length ? Math.max(...gusts) : undefined,
      partial: items.length < 8,
    };
  });
}

/* ---------- Air Pollution API + One Call alerts ---------- */

export interface OWAirPollution {
  list: {
    dt: number;
    main: { aqi: number };
    components: { co: number; no2: number; o3: number; so2: number; pm2_5: number; pm10: number };
  }[];
}

export interface OWAlert {
  id: string;
  sender_name: string;
  event: string;
  start: number;
  end: number;
  description?: { language: string; description: string }[];
}

export function toAirQuality(raw: OWAirPollution): AirQuality | null {
  const entry = raw.list?.[0];
  if (!entry) return null;
  const index = Math.min(5, Math.max(1, Math.round(entry.main.aqi))) as AirQuality["index"];
  const c = entry.components;
  return {
    time: entry.dt,
    index,
    pollutants: { pm2_5: c.pm2_5, pm10: c.pm10, o3: c.o3, no2: c.no2, so2: c.so2, co: c.co },
  };
}

export function toAlert(raw: OWAlert): WeatherAlert {
  const texts = raw.description ?? [];
  const text = texts.find((t) => t.language.toLowerCase().startsWith("en")) ?? texts[0];
  return {
    id: raw.id,
    event: raw.event,
    sender: raw.sender_name,
    start: raw.start,
    end: raw.end,
    description: text?.description ?? "",
  };
}
