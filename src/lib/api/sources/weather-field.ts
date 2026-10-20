import "server-only";
import { FIELD_REVALIDATE_SECONDS, MAX_DATA_AGE_SECONDS, WEATHER_STALE_SECONDS } from "@/constants/cache";
import { WeatherProviderError } from "@/lib/api/providers/openweather";
import { mapCode } from "@/lib/api/providers/openmeteo";
import { fieldColor, type FieldSample } from "@/lib/atlas/field-color";
import { TWILIGHT } from "@/lib/weather/frames";
import { FIELD_FORECAST_DAYS } from "@/constants/atlas";
import type { FieldHour, Lattice, WeatherField } from "@/types/atlas";
import type { Condition } from "@/types/weather";
import { cacheLife } from "next/cache";

/**
 * The weather of a lattice of places, as colours (Atlas, WTH-272, ADR-026): one Open-Meteo request asks for every point at
 * once (each point is one call on its meter, so the lattice is capped, see `latticeFor`), and each place's weather
 * becomes a colour (`fieldColor`) in the lattice's order. The lattice sits on a fixed grid, so the same view and its
 * neighbours share one cache entry, kept a quarter of an hour. A model's reading of the places, interpolated between
 * them when drawn, never a measurement. Like the cloud grid, always Open-Meteo, whatever provider the pages use.
 */

type Reading = { temperature_2m?: number | null; cloud_cover?: number | null; precipitation?: number | null; weather_code?: number | null };
type Point = {
  current?: { time?: number } & Reading;
  hourly?: { time?: number[] } & { [K in keyof Reading]?: (number | null)[] };
  daily?: { time?: number[]; sunrise?: (number | null)[]; sunset?: (number | null)[] };
};

/** The sun times of the day an hour falls in, from the place's daily rows (in GMT, as asked); the first day's when none matches */
function sunOf(p: Point, ts: number): { sunrise: number | null | undefined; sunset: number | null | undefined } {
  const days = p.daily?.time ?? [];
  let i = 0;
  for (let k = 0; k < days.length; k++) if (days[k] <= ts) i = k;
  return { sunrise: p.daily?.sunrise?.[i], sunset: p.daily?.sunset?.[i] };
}

/** A place's reading as the colour engine's sample */
function sampleOf(reading: Reading | null, fallbackTemp: number, light: number): { sample: FieldSample; temp: number } {
  const code = reading?.weather_code;
  const { condition, intensity } = typeof code === "number" ? mapCode(code) : { condition: "clear" as Condition, intensity: "moderate" as const };
  const temp = reading?.temperature_2m ?? fallbackTemp;
  return { temp, sample: { temp, cloudCover: reading?.cloud_cover ?? 0, precipitation: reading?.precipitation ?? 0, condition, intensity, light } };
}

/** The solar scale of the palette (0 sunrise, 1 sunset, below 0 before it and above 1 after it), as the page's frames have it */
export function solarLight(ts: number, sunrise: number | null | undefined, sunset: number | null | undefined, polarDark = false): number {
  if (sunrise == null || sunset == null) return polarDark ? -1 : 0.45;
  if (ts < sunrise) return -Math.min((sunrise - ts) / TWILIGHT, 1);
  if (ts > sunset) return 1 + Math.min((ts - sunset) / TWILIGHT, 1);
  return (ts - sunrise) / (sunset - sunrise);
}

/** What Open-Meteo answered for a lattice, as the field: null where a place has no reading, which is the sea's temperature of its neighbours */
export function parseField(raw: unknown, lattice: Lattice): WeatherField {
  const count = lattice.lats.length * lattice.lons.length;
  if (!Array.isArray(raw) || raw.length !== count) throw new WeatherProviderError("Open-Meteo field is incomplete");
  const points = raw as Point[];
  const time = points.find((p) => typeof p.current?.time === "number")?.current?.time;
  if (time === undefined) throw new WeatherProviderError("Open-Meteo field has no reading");

  const colors: string[] = [];
  const temps: number[] = [];
  const known = points.map((p) => (typeof p.current?.temperature_2m === "number" ? p.current : null));
  const fallbackTemp = known.find((c) => c)?.temperature_2m ?? 15;
  points.forEach((p, i) => {
    const c = known[i];
    const sun = sunOf(p, c?.time ?? time);
    const { sample, temp } = sampleOf(c, fallbackTemp, solarLight(c?.time ?? time, sun.sunrise, sun.sunset));
    temps.push(Math.round(temp * 10) / 10);
    colors.push(fieldColor(sample));
  });
  return { ...lattice, provider: "open-meteo", time, colors, temps, hours: hoursOf(points) };
}

/**
 * The hours of the field from now on, as colours (WTH-345): the hours every place has, from the first place's own list,
 * each place coloured by its own weather and its own sun at that hour. A place missing an hour takes that hour's
 * temperature from the others, as for now. None when the answer carries no hours.
 */
function hoursOf(points: Point[]): FieldHour[] {
  const times = points[0]?.hourly?.time ?? [];
  const now = points.find((p) => typeof p.current?.time === "number")?.current?.time ?? 0;
  const out: FieldHour[] = [];
  times.forEach((t, h) => {
    // The hour that holds now and the ones after it: the time bar never goes back
    if (t + 3600 <= now) return;
    const readings = points.map((p) => {
      const v = p.hourly;
      if (!v || v.time?.[h] !== t) return null;
      const r: Reading = { temperature_2m: v.temperature_2m?.[h], cloud_cover: v.cloud_cover?.[h], precipitation: v.precipitation?.[h], weather_code: v.weather_code?.[h] };
      return typeof r.temperature_2m === "number" ? r : null;
    });
    const fallback = readings.find((r) => r)?.temperature_2m;
    if (typeof fallback !== "number") return;
    const colors = points.map((p, i) => {
      const sun = sunOf(p, t);
      return fieldColor(sampleOf(readings[i], fallback, solarLight(t, sun.sunrise, sun.sunset)).sample);
    });
    out.push({ time: t, colors });
  });
  return out;
}

/** One request for the whole lattice; no cache here (see `weatherField`) */
export async function fetchField(lattice: Lattice, fetchImpl: typeof fetch = fetch): Promise<WeatherField> {
  const points = lattice.lats.flatMap((la) => lattice.lons.map((lo) => [la, lo] as const));
  const params = new URLSearchParams({
    latitude: points.map(([la]) => la).join(","),
    longitude: points.map(([, lo]) => lo).join(","),
    current: "temperature_2m,cloud_cover,precipitation,weather_code",
    hourly: "temperature_2m,cloud_cover,precipitation,weather_code",
    daily: "sunrise,sunset",
    forecast_days: String(FIELD_FORECAST_DAYS),
    timeformat: "unixtime",
    timezone: "GMT",
  });
  const res = await fetchImpl(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new WeatherProviderError(`Open-Meteo field responded ${res.status}`, res.status);
  return parseField(await res.json(), lattice);
}

/** The field of a lattice through the shared cache: the arguments are the key, so a lattice is one entry for a quarter of an hour */
export async function weatherField(step: number, lats: number[], lons: number[]): Promise<WeatherField> {
  "use cache";
  cacheLife({ revalidate: FIELD_REVALIDATE_SECONDS, stale: WEATHER_STALE_SECONDS, expire: MAX_DATA_AGE_SECONDS });
  return fetchField({ step, lats, lons });
}

/**
 * A made-up field for the sample weather (tests, and a machine with no provider): cooler to the north, a cloudy patch in
 * the west, a rainy corner in the south west. Labelled "mock", so the page says it is an example.
 */
export function sampleField(lattice: Lattice): WeatherField {
  const { lats, lons } = lattice;
  const colors: string[] = [];
  const temps: number[] = [];
  const [lat0, lat1] = [lats[0], lats[lats.length - 1]];
  const [lon0, lon1] = [lons[0], lons[lons.length - 1]];
  for (const lat of lats) {
    for (const lon of lons) {
      const fy = lat1 === lat0 ? 0.5 : (lat - lat0) / (lat1 - lat0);
      const fx = lon1 === lon0 ? 0.5 : (lon - lon0) / (lon1 - lon0);
      const temp = Math.round((28 - 16 * fy + 4 * fx) * 10) / 10;
      const rainy = fx < 0.4 && fy < 0.4;
      const cloudy = fx < 0.6;
      temps.push(temp);
      colors.push(
        fieldColor({
          temp,
          cloudCover: rainy ? 100 : cloudy ? 80 : 10,
          precipitation: rainy ? 3 : 0,
          condition: rainy ? "rain" : cloudy ? "cloudy" : "clear",
          intensity: "moderate",
          light: 0.5,
        }),
      );
    }
  }
  // Three days of hours from the current hour, as the sample point's own forecast has them: a day that warms and cools,
  // the night darker, the rain moving east
  const start = Math.floor(Date.now() / 3_600_000) * 3600;
  const hours: FieldHour[] = [];
  for (let h = 0; h < FIELD_FORECAST_DAYS * 24; h++) {
    const light = ((h + 12) % 24) / 12 - 0.5; // midday at h = 0, as `time` is taken
    const shift = 4 * Math.cos((h / 24) * 2 * Math.PI);
    const hourColors: string[] = [];
    for (const lat of lats) {
      for (const lon of lons) {
        const fy = lat1 === lat0 ? 0.5 : (lat - lat0) / (lat1 - lat0);
        const fx = lon1 === lon0 ? 0.5 : (lon - lon0) / (lon1 - lon0);
        const rainy = Math.abs(fx - (h % 24) / 24) < 0.25 && fy < 0.5;
        hourColors.push(
          fieldColor({
            temp: Math.round((24 - 16 * fy + 4 * fx + shift) * 10) / 10,
            cloudCover: rainy ? 100 : 30,
            precipitation: rainy ? 3 : 0,
            condition: rainy ? "rain" : "partly-cloudy",
            intensity: "moderate",
            light: light < 0 || light > 1 ? 1.6 : light,
          }),
        );
      }
    }
    hours.push({ time: start + h * 3600, colors: hourColors });
  }
  return { ...lattice, provider: "mock", time: start, colors, temps, hours };
}
