import { placeHref, type PlaceRef } from "@/lib/place";
import type { PlaceSummary } from "@/types/place";

/** One request per place per visit, shared by every render and remount. */
const requests = new Map<string, Promise<PlaceSummary | null>>();

/** A place in a few numbers, from /api/summary; null when it can't be had. */
export function fetchSummary(place: PlaceRef): Promise<PlaceSummary | null> {
  const key = `${place.lat.toFixed(2)},${place.lon.toFixed(2)}`;
  let request = requests.get(key);
  if (!request) {
    request = fetch(placeHref(place).replace("/?", "/api/summary?"))
      .then((res) => (res.ok ? (res.json() as Promise<PlaceSummary>) : null))
      .catch(() => null);
    requests.set(key, request);
  }
  return request;
}
