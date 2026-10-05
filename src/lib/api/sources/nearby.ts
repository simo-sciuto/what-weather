import "server-only";
import { cacheLife } from "next/cache";
import { MAX_DATA_AGE_SECONDS, WEATHER_REVALIDATE_SECONDS } from "@/lib/weather/constants";
import { mapCode } from "@/lib/api/providers/openmeteo";
import type { Condition } from "@/types/weather";

/**
 * The weather right now in a handful of places at once, for the towns around
 * the one on show: their temperature and sky, in a single request to
 * Open-Meteo (it takes a list of coordinates), whatever provider the page
 * runs on. Going through the provider would cost a full forecast per town.
 */

const FORECAST = "https://api.open-meteo.com/v1/forecast";

export type NearbyReading = {
  temp: number;
  condition: Condition;
  night: boolean;
};

type Current = { temperature_2m: number | null; weather_code: number | null; is_day: number | null };

/** Keyed on the coordinate lists; a failure throws, and a throw is never cached. */
async function readings(latitudes: string, longitudes: string): Promise<(NearbyReading | null)[]> {
  "use cache";
  cacheLife({ revalidate: WEATHER_REVALIDATE_SECONDS, expire: MAX_DATA_AGE_SECONDS, stale: 5 * 60 });
  const q = new URLSearchParams({ latitude: latitudes, longitude: longitudes, current: "temperature_2m,weather_code,is_day" });
  const res = await fetch(`${FORECAST}?${q}`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`${res.status}`);
  // One place comes back as an object, several as a list in the order asked.
  const raw = (await res.json()) as { current?: Current } | { current?: Current }[];
  return (Array.isArray(raw) ? raw : [raw]).map(({ current: c }) =>
    c?.temperature_2m == null || c.weather_code == null
      ? null
      : { temp: c.temperature_2m, condition: mapCode(c.weather_code).condition, night: c.is_day === 0 },
  );
}

/** A reading per place, in order; null for each one that couldn't be had. */
export async function nearbyWeather(places: { lat: number; lon: number }[]): Promise<(NearbyReading | null)[]> {
  if (!places.length) return [];
  try {
    const list = await readings(places.map((p) => p.lat.toFixed(2)).join(","), places.map((p) => p.lon.toFixed(2)).join(","));
    return places.map((_, i) => list[i] ?? null);
  } catch {
    return places.map(() => null);
  }
}
