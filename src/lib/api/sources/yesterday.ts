import "server-only";
import { WEATHER_REVALIDATE_SECONDS } from "@/lib/weather/constants";
import { changeSinceYesterday, type Series } from "@/lib/weather/yesterday";

/**
 * The request behind the comparison with yesterday (see lib/weather/yesterday): both temperatures come from
 * Open-Meteo's hourly series, whatever provider the page runs on.
 */

const FORECAST = "https://api.open-meteo.com/v1/forecast";
/** The comparison is a detail: a slow answer is dropped rather than waited for. */
const TIMEOUT_MS = 4000;

/** Null when Open-Meteo can't be reached in time; the page does without. */
export async function sinceYesterday(lat: number, lon: number): Promise<number | null> {
  try {
    const q = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      hourly: "temperature_2m",
      past_days: "1",
      forecast_days: "2",
      timeformat: "unixtime",
    });
    const res = await fetch(`${FORECAST}?${q}`, {
      next: { revalidate: WEATHER_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const { hourly } = (await res.json()) as { hourly?: Series };
    return hourly ? changeSinceYesterday(hourly, Date.now() / 1000) : null;
  } catch {
    return null;
  }
}
