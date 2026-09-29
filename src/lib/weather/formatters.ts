import { regionName } from "./regions";
import type { CurrentWeather, Place } from "./types";

/** Rounds away -0 so we never render "-0°". */
function roundTemp(t: number): number {
  return Math.round(t) || 0;
}

export function formatTemp(t: number): string {
  return `${tempDigits(t)}°`;
}

/**
 * One Intl.DateTimeFormat per locale and options, reused. Building a
 * formatter costs about 60 times more than using one, and a page render
 * formats thousands of dates (every hour of the timeline, every sun event).
 */
const formatters = new Map<string, Intl.DateTimeFormat>();

export function dateFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = formatters.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, format);
  }
  return format;
}

/** "17:00" in the place's own time zone. */
export function formatTime(ts: number, timeZone: string): string {
  return dateFormat("it-IT", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ts * 1000));
}

/** Fractional hour of day (0..24) in the place's time zone. */
export function localHour(ts: number, timeZone: string): number {
  const parts = dateFormat("en-GB", { timeZone, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(
    new Date(ts * 1000),
  );
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") + get("minute") / 60;
}

/** A date at the place, in the given Intl format ("mercoledì", "30 set"…). */
export function formatDate(ts: number, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  return dateFormat("it-IT", { timeZone, ...options }).format(new Date(ts * 1000));
}

/** Calendar day at the place, as "YYYY-MM-DD". */
/** ["37,77° N", "122,42° O"]: a place's coordinates, the Italian way (O for ovest). */
export function formatCoords(lat: number, lon: number): [string, string] {
  const part = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2).replace(".", ",")}° ${v >= 0 ? pos : neg}`;
  return [part(lat, "N", "S"), part(lon, "E", "O")];
}

/** "272/365": the day of the year of a local day ("2026-09-29"), over the year's length. */
export function dayOfYear(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const n = (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86_400_000;
  const days = (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) / 86_400_000;
  return `${n}/${days}`;
}

export function localDay(ts: number, timeZone: string): string {
  return dateFormat("en-CA", { timeZone }).format(new Date(ts * 1000));
}

const regionNames = new Intl.DisplayNames(["it"], { type: "region" });

function countryName(code: string): string {
  if (!code) return "";
  try {
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/**
 * The place's region and country in Italian, each empty when unknown or the
 * same as the place's own name (Singapore, Singapore).
 */
export function placeParts(place: Place): { region: string; country: string } {
  // Translated here too, so places saved before (in the browser, in the cookie) read in Italian.
  const keep = (part: string | undefined) => (part && part !== place.name ? part : "");
  return { region: keep(regionName(place.region)), country: keep(countryName(place.country)) };
}

/** Secondary line under the place name, e.g. "Lombardia, Italia". */
export function placeSubtitle(place: Place): string {
  const { region, country } = placeParts(place);
  return [region, country].filter(Boolean).join(", ");
}

/** Short, friendly condition label, e.g. "Pioggia debole", "Coperto". */
export function conditionLabel(
  c: Pick<CurrentWeather, "condition" | "intensity"> & { cloudCover?: number },
): string {
  // Every precipitation noun is feminine, so one pair of adjectives serves them all.
  const scale = (noun: string) =>
    c.intensity === "light" ? `${noun} debole` : c.intensity === "heavy" ? `${noun} forte` : noun;
  switch (c.condition) {
    case "clear":
      return "Sereno";
    case "partly-cloudy":
      return "Poco nuvoloso";
    case "cloudy":
      return c.cloudCover != null && c.cloudCover >= 90 ? "Coperto" : "Nuvoloso";
    case "fog":
      return "Nebbia";
    case "drizzle":
      return scale("Pioviggine");
    case "rain":
      return scale("Pioggia");
    case "snow":
      return scale("Neve");
    case "thunderstorm":
      return c.intensity === "heavy" ? "Temporale forte" : "Temporale";
  }
}

/** Typographic minus for negative temperatures. */
export function tempDigits(t: number): string {
  return String(roundTemp(t)).replace("-", "−");
}

/** "2 h 10 min", "45 min"; compact: "2h 10m", "45m" */
export function formatDuration(seconds: number, style: "long" | "compact" = "long"): string {
  const total = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const [hu, mu] = style === "compact" ? ["h", "m"] : [" h", " min"];
  if (h === 0) return `${m}${mu}`;
  return m === 0 ? `${h}${hu}` : `${h}${hu} ${m}${mu}`;
}

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** A signed change with a typographic minus: "+3 hPa", "−1 hPa", "±0 hPa". */
export function formatSigned(value: number, unit: string): string {
  const n = Math.round(value);
  return `${n > 0 ? "+" : n < 0 ? "\u2212" : "±"}${Math.abs(n)} ${unit}`;
}

/** Italian prepositions before a clock time, as said aloud: plain, elided (l'una), and bare (mezzanotte). */
const PREPOSITIONS = {
  alle: ["alle", "all’", "a"],
  "verso le": ["verso le", "verso l’", "verso"],
  dalle: ["dalle", "dall’", "da"],
  "fino alle": ["fino alle", "fino all’", "fino a"],
  "tra le": ["tra le", "tra l’", "tra"],
  "e le": ["e le", "e l’", "e"],
} as const;

export type Preposition = keyof typeof PREPOSITIONS;

/**
 * A time the way it's said, with its preposition: "verso le 17", "all’una",
 * "a mezzanotte", "verso mezzogiorno"; minutes only when there are some
 * ("alle 9:30"). For sentences; tables and axes keep formatTime.
 */
export function spokenTime(ts: number, timeZone: string, prep: Preposition): string {
  const [plain, elided, bare] = PREPOSITIONS[prep];
  const [hh, mm] = formatTime(ts, timeZone).split(":").map(Number);
  if (mm !== 0) return hh === 1 ? `${elided}1:${String(mm).padStart(2, "0")}` : `${plain} ${hh}:${String(mm).padStart(2, "0")}`;
  if (hh === 0) return `${bare} mezzanotte`;
  if (hh === 12) return `${bare} mezzogiorno`;
  if (hh === 1) return `${elided}una`;
  return `${plain} ${hh}`;
}
