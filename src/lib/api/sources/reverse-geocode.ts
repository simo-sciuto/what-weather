import "server-only";
import type { Cell, PlaceNames } from "@/types/atlas";

/**
 * Where a cell is, by name (Atlas, ADR-024): Mapbox's reverse geocoding for the cell's centre, from the country down to
 * the quarter. One request, asked beside the cell's weather, never alone and never while the map moves. The result is
 * Mapbox's temporary geocoding: it is read for the page that asked and not stored here (no `use cache`, no database).
 * It never throws: no token, a slow answer, nothing found (the open sea) and a failure are all `null`, and the weather
 * of the cell does not wait on it for long.
 */

const ENDPOINT = "https://api.mapbox.com/search/geocode/v6/reverse";
const TYPES = "neighborhood,locality,place,district,region,country";
export const GEOCODE_TIMEOUT_MS = 2500;

type Named = { name?: unknown };
type Feature = {
  properties?: {
    feature_type?: unknown;
    name?: unknown;
    coordinates?: { latitude?: unknown; longitude?: unknown };
    context?: Record<string, Named | undefined>;
  };
};

const text = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : undefined);

function distanceKm(a: Cell, lat: number, lon: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(lat)) * Math.sin(rad(lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The geocoder's answer as the names of the levels it gives, or null when it gives none */
export function parseReverse(body: unknown, cell: Cell): PlaceNames | null {
  const feature = (body as { features?: Feature[] } | null)?.features?.[0];
  const props = feature?.properties;
  if (!props) return null;
  const context = props.context ?? {};
  const own = text(props.name);
  const type = text(props.feature_type);
  const level = (key: string) => text(context[key]?.name) ?? (type === key ? own : undefined);
  const names: PlaceNames = {
    country: level("country"),
    region: level("region"),
    district: level("district"),
    place: level("place"),
    locality: level("locality") ?? level("neighborhood"),
  };
  const lat = props.coordinates?.latitude;
  const lon = props.coordinates?.longitude;
  if (typeof lat === "number" && typeof lon === "number") names.nearKm = Math.round(distanceKm(cell, lat, lon) * 10) / 10;
  return Object.entries(names).some(([k, v]) => k !== "nearKm" && v) ? names : null;
}

export async function reverseGeocode(
  cell: Cell,
  options: { token?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<PlaceNames | null> {
  const token = options.token ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  const run = options.fetchImpl ?? fetch;
  const query = new URLSearchParams({ longitude: String(cell.lon), latitude: String(cell.lat), types: TYPES, language: "it", limit: "1", access_token: token });
  try {
    const response = await run(`${ENDPOINT}?${query}`, { cache: "no-store", signal: AbortSignal.timeout(options.timeoutMs ?? GEOCODE_TIMEOUT_MS) });
    if (!response.ok) return null;
    return parseReverse(await response.json(), cell);
  } catch {
    return null;
  }
}
