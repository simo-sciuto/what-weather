import { localDay, localHour, spokenTime } from "./formatters";
import type { WeatherData } from "./types";

export interface TempRange {
  min: number;
  max: number;
  /** "today" = the full calendar day; "24h" = the next 24 hours from now */
  span: "today" | "24h";
  /** For "24h": when the extremes fall, "minima stanotte verso le 5", so they don't read as today's */
  note?: string;
}

/**
 * Today's high and low. When the provider only covers part of today (the free
 * forecast starts from now), a "today" high/low would be wrong — late in the
 * evening it would miss the afternoon — so we report the next 24 hours instead.
 */
export function tempRange(data: WeatherData): TempRange {
  const todayKey = localDay(data.current.time, data.timezone);
  const today = data.daily.find((d) => localDay(d.time, data.timezone) === todayKey);
  if (today && !today.partial) return { min: today.min, max: today.max, span: "today" };

  const next = data.hourly.filter((h) => h.time <= data.current.time + 86400);
  const points = [{ time: data.current.time, temp: data.current.temp }, ...next];
  const low = points.reduce((a, b) => (b.temp < a.temp ? b : a));
  const high = points.reduce((a, b) => (b.temp > a.temp ? b : a));
  const note = [
    high.time !== data.current.time && `massima ${when(high.time, data)}`,
    low.time !== data.current.time && `minima ${when(low.time, data)}`,
  ]
    .filter(Boolean)
    .join(", ");
  return { min: low.temp, max: high.temp, span: "24h", note: note || "nelle prossime 24 ore" };
}

/** "verso le 15", "stanotte verso le 5", "domani verso le 14" */
function when(ts: number, data: WeatherData): string {
  const at = spokenTime(ts, data.timezone, "verso le");
  if (localDay(ts, data.timezone) === localDay(data.current.time, data.timezone)) return at;
  return `${localHour(ts, data.timezone) < 7 ? "stanotte" : "domani"} ${at}`;
}
