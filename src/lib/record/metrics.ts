import type { ConditionFamily, RecordInput } from "./types";
import { placeSlug } from "./seed";

export type Metric = { key: MetricKey; label: string; value: string };

type MetricKey = "feels" | "range" | "wind" | "gust" | "humidity" | "uv" | "precip" | "pressure" | "visibility" | "cloud";

/** What each family reports first; the fallbacks fill a cluster that a missing reading left short */
export const FAMILY_METRICS: Record<ConditionFamily, MetricKey[]> = {
  CLEAR: ["uv", "humidity", "wind", "feels"],
  CLOUD: ["cloud", "wind", "humidity"],
  FOG: ["visibility", "humidity", "feels"],
  RAIN: ["precip", "wind", "humidity"],
  STORM: ["gust", "precip", "pressure"],
  SNOW: ["feels", "wind", "precip"],
  WIND: ["wind", "gust", "feels"],
};
const FALLBACK: MetricKey[] = ["range", "humidity", "wind", "pressure", "feels", "cloud"];
export const MIN_METRICS = 3;
export const MAX_METRICS = 5;

const POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const compassPoint = (deg: number) => POINTS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

/** A true minus, never a hyphen */
export const degrees = (t: number) => `${Math.round(t) < 0 ? "−" : ""}${Math.abs(Math.round(t))}°`;
const pad2 = (n: number) => String(Math.round(n)).padStart(2, "0");

function metric(key: MetricKey, r: RecordInput): Metric | null {
  switch (key) {
    case "feels":
      return r.feelsLike == null ? null : { key, label: "FEELS", value: degrees(r.feelsLike) };
    case "range":
      return r.high == null || r.low == null ? null : { key, label: "HIGH / LOW", value: `${degrees(r.high)} / ${degrees(r.low)}` };
    case "wind":
      return r.windSpeed == null
        ? null
        : { key, label: "WIND", value: `${pad2(r.windSpeed)} KM/H${r.windDeg == null ? "" : ` ${compassPoint(r.windDeg)}`}` };
    case "gust":
      return r.windGust == null ? null : { key, label: "GUSTS", value: `${pad2(r.windGust)} KM/H` };
    case "humidity":
      return r.humidity == null ? null : { key, label: "HUMIDITY", value: `${Math.round(r.humidity)}%` };
    case "uv":
      return r.uv == null ? null : { key, label: "UV", value: pad2(r.uv) };
    case "precip":
      return r.precipitation == null ? null : { key, label: "PRECIP", value: `${r.precipitation.toFixed(1)} MM/H` };
    case "pressure":
      return r.pressure == null ? null : { key, label: "PRESSURE", value: `${Math.round(r.pressure)} HPA` };
    case "visibility":
      return r.visibility == null
        ? null
        : { key, label: "VISIBILITY", value: `${r.visibility < 10 ? r.visibility.toFixed(1) : Math.round(r.visibility)} KM` };
    case "cloud":
      return r.cloudCover == null ? null : { key, label: "CLOUD", value: `${Math.round(r.cloudCover)}%` };
  }
}

/**
 * The weather cluster: the family's own readings first, topped up from the fallbacks so a missing field never
 * leaves a gap; three to five pairs, never an empty value.
 */
export function weatherMetrics(family: ConditionFamily, r: RecordInput): Metric[] {
  const out: Metric[] = [];
  for (const key of [...FAMILY_METRICS[family], ...FALLBACK]) {
    if (out.some((m) => m.key === key)) continue;
    const m = metric(key, r);
    if (!m) continue;
    // Fallbacks only until the cluster has its minimum
    if (!FAMILY_METRICS[family].includes(key) && out.length >= MIN_METRICS) break;
    out.push(m);
    if (out.length === MAX_METRICS) break;
  }
  return out;
}

/** 4.4667 S, 29.1 E -> "04°28'S", "29°06'E" */
export function formatCoord(value: number, axis: "lat" | "lon"): string {
  const abs = Math.abs(value);
  let deg = Math.floor(abs);
  let min = Math.round((abs - deg) * 60);
  if (min === 60) [deg, min] = [deg + 1, 0];
  const hemi = axis === "lat" ? (value < 0 ? "S" : "N") : value < 0 ? "W" : "E";
  return `${axis === "lat" ? pad2(deg) : deg}°${pad2(min)}'${hemi}`;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "2026-10-05" -> "05 OCT 2026" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${pad2(d)} ${MONTHS[m - 1]} ${y}`;
}

export function dayOfYear(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
}

/** "WW / 2026 / 278 / TSHURU": archival, deterministic */
export function recordId(placeName: string, iso: string): string {
  return `WW / ${iso.slice(0, 4)} / ${String(dayOfYear(iso)).padStart(3, "0")} / ${placeSlug(placeName)}`;
}

/** The condition as the record prints it */
export const CONDITION_WORD: Record<ConditionFamily, string> = {
  CLEAR: "CLEAR",
  CLOUD: "CLOUD",
  FOG: "FOG",
  RAIN: "RAIN",
  STORM: "STORM",
  SNOW: "SNOW",
  WIND: "WIND",
};

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty"];

/** 31 -> "thirty-one", -24 -> "minus twenty-four": the minor motif NUMERAL + WORD */
export function temperatureWords(t: number): string {
  const n = Math.abs(Math.round(t));
  const words = n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ""}`;
  return `${t < -0.5 ? "minus " : ""}${words}`;
}
