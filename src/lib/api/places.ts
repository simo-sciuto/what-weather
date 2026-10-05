import type { Place } from "@/types/weather";

/**
 * The places that match a search, from /api/places. Rejects on a failed request or an abort: the caller
 * tells a cancelled search (its own abort) from a real failure.
 */
export async function fetchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const res = await fetch(`/api/places?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) throw new Error(String(res.status));
  return ((await res.json()) as { places: Place[] }).places;
}
