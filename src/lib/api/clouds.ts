import type { CloudGrid } from "@/types/map";

/** One request per place, for every map that shows its clouds; forgotten after the grid's own hour. */
const requests = new Map<string, Promise<CloudGrid | null>>();

/** The cloud and rain grid around a place, from /api/clouds; null when it can't be had. */
export function fetchClouds(lat: number, lon: number): Promise<CloudGrid | null> {
  const url = `/api/clouds?lat=${lat}&lon=${lon}`;
  let request = requests.get(url);
  if (!request) {
    request = fetch(url)
      .then((res) => (res.ok ? (res.json() as Promise<CloudGrid>) : null))
      .then((g) => (g?.times?.length ? g : null))
      .catch(() => null);
    requests.set(url, request);
    setTimeout(() => requests.delete(url), 60 * 60 * 1000);
  }
  return request;
}
