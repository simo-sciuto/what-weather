import { FLIGHT_MAX_MS, FLIGHT_MIN_MS } from "@/constants/atlas";

/** The great-circle distance between two points, in kilometres */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * How long the flight to a searched city lasts: the minimum for a hop, the maximum from across a continent, and between
 * the two a slow rise (the square root of the distance), so that Torino to Milano is brisk and Torino to Sydney is
 * long enough to be seen and not so long it is waited for.
 */
export function flightMs(km: number): number {
  return Math.round(Math.min(FLIGHT_MAX_MS, Math.max(FLIGHT_MIN_MS, FLIGHT_MIN_MS + Math.sqrt(Math.max(0, km)) * 60)));
}
