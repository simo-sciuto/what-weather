import type { PlaceNames } from "@/types/atlas";

/**
 * The name of the place the map is aimed at, as precise as the zoom (ADR-024): the country from far, then the region,
 * the province, the town, and from close the quarter, shown with the town it is in (the quarter is the `detail`, the
 * town the `name`, one title of two lines). A level the geocoder does not know falls back to the next coarser one. The
 * coarser names come as the `context`. `near` says the name is the nearest place and not the place the cell is in (its
 * own point is far from the cell), for the finest levels, where saying "Torino" of a field ten kilometres out would be
 * a lie.
 */

const LEVELS = ["country", "region", "district", "place", "locality"] as const;
/** The zoom from which each level is the one shown: from far to close */
const FROM_ZOOM = [-Infinity, 5, 7, 9, 11] as const;
/** From this far, the finest names are "near", not "in" */
export const NEAR_KM = 5;

export type PlaceLabel = {
  /** The title: the level the zoom asks for, or, from the quarter's zoom, the town */
  name: string;
  /** From the quarter's zoom, the quarter, below the town and as big */
  detail: string | null;
  /** The coarser names above the title's own level, nearest first, at most two */
  context: string | null;
  near: boolean;
};

export function placeLabel(place: PlaceNames | null, zoom: number): PlaceLabel | null {
  if (!place) return null;
  let target = 0;
  FROM_ZOOM.forEach((z, i) => {
    if (zoom >= z) target = i;
  });
  const far = (place.nearKm ?? 0) >= NEAR_KM;
  /** The names coarser than level `i`, other than `name`, nearest first, at most two */
  const above = (i: number, name: string) =>
    LEVELS.slice(0, i)
      .map((l) => place[l])
      .filter((n): n is string => !!n && n !== name)
      .slice(-2)
      .reverse()
      .join(", ") || null;

  // the finest level known at or above the one the zoom asks for
  for (let i = target; i >= 0; i--) {
    const found = place[LEVELS[i]];
    if (!found) continue;
    if (LEVELS[i] === "locality") {
      // the quarter is told with the town it is in
      const townAt = [3, 2, 1].find((t) => place[LEVELS[t]] && place[LEVELS[t]] !== found);
      if (townAt !== undefined) return { name: place[LEVELS[townAt]]!, detail: found, context: above(townAt, place[LEVELS[townAt]]!), near: far };
    }
    return { name: found, detail: null, context: above(i, found), near: i >= 3 && far };
  }
  return null;
}
