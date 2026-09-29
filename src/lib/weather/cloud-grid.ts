import "server-only";
import { cacheLife } from "next/cache";
import { WeatherProviderError } from "./openweather";

/**
 * Cloud cover and precipitation, hour by hour, on a grid of points around a
 * place: what the map animates. One Open-Meteo request asks for every point
 * at once. The grid sits on a fixed lattice (steps of LAT_STEP × LON_STEP
 * degrees), so nearby places share one grid, and one cache entry, per hour.
 */

export interface CloudGrid {
  /** Latitudes of the rows, north to south */
  lats: number[];
  /** Longitudes of the columns, west to east */
  lons: number[];
  /** Unix seconds of each hourly frame, from the current hour on */
  times: number[];
  /** Per frame, cloud cover (%) of every point, row by row */
  cloud: number[][];
  /** Per frame, precipitation (mm/h) of every point, row by row */
  precip: number[][];
}

const ROWS = 7;
const COLS = 7;
/** About 55 km in both directions at mid latitudes, so the grid covers ~330 × 330 km. */
const LAT_STEP = 0.5;
const LON_STEP = 0.7;
/** The next twelve hours: the stretch where an hourly map of clouds and rain is worth watching. */
export const CLOUD_HOURS = 12;

const snap = (v: number, step: number) => Math.round(v / step) * step;
const fixed = (v: number) => Number(v.toFixed(3));

interface OMPoint {
  hourly: { time: number[]; cloud_cover: (number | null)[]; precipitation: (number | null)[] };
}

export async function cloudGrid(lat: number, lon: number): Promise<CloudGrid> {
  const cLat = snap(lat, LAT_STEP);
  const cLon = snap(lon, LON_STEP);
  return loadGrid(fixed(cLat), fixed(cLon));
}

async function loadGrid(cLat: number, cLon: number): Promise<CloudGrid> {
  "use cache";
  // Open-Meteo runs its models hourly; each request counts as one call per point, so keep it for the hour.
  cacheLife({ revalidate: 60 * 60, expire: 2 * 60 * 60 });

  const lats = Array.from({ length: ROWS }, (_, r) => fixed(Math.min(89, Math.max(-89, cLat + (Math.floor(ROWS / 2) - r) * LAT_STEP))));
  const lons = Array.from({ length: COLS }, (_, c) => fixed(cLon + (c - Math.floor(COLS / 2)) * LON_STEP));
  const points = lats.flatMap((la) => lons.map((lo) => [la, lo] as const));

  const params = new URLSearchParams({
    latitude: points.map(([la]) => la).join(","),
    longitude: points.map(([, lo]) => lo).join(","),
    hourly: "cloud_cover,precipitation",
    forecast_hours: String(CLOUD_HOURS),
    timeformat: "unixtime",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new WeatherProviderError(`Open-Meteo cloud grid responded ${res.status}`, res.status);
  const raw = (await res.json()) as OMPoint[];
  if (!Array.isArray(raw) || raw.length !== points.length) throw new WeatherProviderError("Open-Meteo cloud grid is incomplete");

  const times = raw[0].hourly.time;
  return {
    lats,
    lons,
    times,
    cloud: times.map((_, t) => raw.map((p) => p.hourly.cloud_cover[t] ?? 0)),
    precip: times.map((_, t) => raw.map((p) => p.hourly.precipitation[t] ?? 0)),
  };
}
