import type { PlaceNames } from "@/types/atlas";

/**
 * The name of the place the map is aimed at, as precise as the zoom (ADR-024): the country from far, then the region,
 * the province, the town, and from close the quarter. A level the geocoder does not know falls back to the next
 * coarser one. `near` says the name is the nearest place and not the place the cell is in (its own point is far from
 * the cell), for the finest levels, where saying "Torino" of a field ten kilometres out would be a lie.
 */

const LEVELS = ["country", "region", "district", "place", "locality"] as const;
/** The zoom from which each level is the one shown: from far to close */
const FROM_ZOOM = [-Infinity, 5, 7, 9, 11] as const;
/** From this far, the finest names are "near", not "in" */
export const NEAR_KM = 5;

export type PlaceLabel = { name: string; context: string | null; near: boolean };

export function placeLabel(place: PlaceNames | null, zoom: number): PlaceLabel | null {
  if (!place) return null;
  let target = 0;
  FROM_ZOOM.forEach((z, i) => {
    if (zoom >= z) target = i;
  });
  // the finest level known at or above the one the zoom asks for
  for (let i = target; i >= 0; i--) {
    const name = place[LEVELS[i]];
    if (!name) continue;
    const coarser = LEVELS.slice(0, i)
      .map((l) => place[l])
      .filter((n): n is string => !!n && n !== name);
    return { name, context: coarser.slice(-2).reverse().join(", ") || null, near: i >= 3 && (place.nearKm ?? 0) >= NEAR_KM };
  }
  return null;
}
