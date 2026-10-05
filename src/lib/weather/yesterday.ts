import "server-only";
import { WEATHER_REVALIDATE_SECONDS } from "./constants";
import { formatTemp } from "./formatters";

/**
 * How today compares with yesterday at the same hour. Both temperatures come
 * from one source (Open-Meteo's hourly series, which reaches a day back),
 * whatever provider the page runs on: a reading from one service against
 * another's would show their bias as a change in the weather.
 */

const FORECAST = "https://api.open-meteo.com/v1/forecast";
/** The comparison is a detail: a slow answer is dropped rather than waited for. */
const TIMEOUT_MS = 4000;

type Series = {
  time: number[];
  temperature_2m: (number | null)[];
};

/** The temperature at `t`, between the two hours around it; null outside the series or where it has gaps. */
function tempAt(s: Series, t: number): number | null {
  const i = s.time.findLastIndex((x) => x <= t);
  if (i === -1 || i === s.time.length - 1) return null;
  const [a, b] = [s.temperature_2m[i], s.temperature_2m[i + 1]];
  if (a == null || b == null) return null;
  return a + ((b - a) * (t - s.time[i])) / (s.time[i + 1] - s.time[i]);
}

/** Degrees gained (or lost) since the same time yesterday; null when the series doesn't cover both. */
export function changeSinceYesterday(s: Series, now: number): number | null {
  const today = tempAt(s, now);
  const yesterday = tempAt(s, now - 86400);
  return today == null || yesterday == null ? null : today - yesterday;
}

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

/** "2° in più di ieri", "3° in meno di ieri", "Come ieri": the change as the reading says it. */
export function yesterdayWords(change: number): string {
  const degrees = Math.round(change);
  if (degrees === 0) return "Come ieri";
  return `${formatTemp(Math.abs(degrees))} ${degrees > 0 ? "in più" : "in meno"} di ieri`;
}
