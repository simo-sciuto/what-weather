import { formatDate, formatTime } from "./formatters";

/**
 * How the page writes a moment (ADR-028, W7): always with its day, its hour and the place whose clock it is, so an
 * hour is never read in another zone by mistake, and with where it comes from. Pure: every input passed in.
 */

/** "Lun 19 ott" at the place */
export function momentDay(ts: number, timeZone: string): string {
  const day = formatDate(ts, timeZone, { weekday: "short", day: "numeric", month: "short" });
  return day.charAt(0).toUpperCase() + day.slice(1);
}

/** "Lun 19 ott, 13:05, ora di Torino": the moment on the place's own clock */
export function momentLabel(ts: number, timeZone: string, placeName: string): string {
  return `${momentDay(ts, timeZone)}, ${formatTime(ts, timeZone)}, ora di ${placeName}`;
}

/**
 * Where the moment comes from, said in words: nothing for the current reading ("Adesso"), "previsione" for an hour
 * the provider gave, "previsione stimata" for one worked out between two of its hours (never passed off as given).
 */
export function momentOrigin({ isLive, measured }: { isLive: boolean; measured: boolean }): string | null {
  if (isLive) return null;
  return measured ? "previsione" : "previsione stimata";
}
