import type { PlaceRef } from "@/types/place";
import type { Place } from "@/types/weather";

/**
 * How a place travels between the browser and the server: in the URL
 * (?lat&lon, plus optional display names chosen in search); a bare address
 * lands on a city drawn at random (see weather/random-places).
 * Safe to import from both server and client code.
 */

type Raw = Record<string, unknown>;

const text = (v: unknown, max = 80) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const coord = (v: unknown, limit: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : undefined;
};

export function parsePlaceRef(raw: Raw): PlaceRef | null {
  const lat = coord(raw.lat, 90);
  const lon = coord(raw.lon, 180);
  if (lat == null || lon == null) return null;
  return { lat, lon, name: text(raw.name), region: text(raw.region), country: text(raw.country, 3) };
}

function placeQuery(p: PlaceRef): URLSearchParams {
  const q = new URLSearchParams({ lat: p.lat.toFixed(4), lon: p.lon.toFixed(4) });
  if (p.name) q.set("name", p.name);
  if (p.region) q.set("region", p.region);
  if (p.country) q.set("country", p.country);
  return q;
}

export function placeHref(p: PlaceRef): string {
  return `/?${placeQuery(p)}`;
}

/** The place's Territorio page: the same place in the address, on its own route (WTH-214) */
export function territoryHref(p: PlaceRef): string {
  return `/territorio?${placeQuery(p)}`;
}

/** Two references point at the same place when they agree to ~1 km. */
export function samePlace(a: Pick<Place, "lat" | "lon">, b: Pick<Place, "lat" | "lon">): boolean {
  return Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.01;
}
