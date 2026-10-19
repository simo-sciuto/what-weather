import { NEAR_KM } from "@/lib/atlas/place-label";
import type { AtlasPoint } from "@/types/atlas";
import type { PlaceRef } from "@/types/place";

/**
 * The ways out of the Atlas and into it (the path Explore, Atlas, Create): the place a point stands for, as the
 * other pages take it, and the Atlas's own address for a place. A free point is its coordinates; it is given a name
 * only when the geocoder found a town the cell is in (not "near"), so a field ten kilometres out is never called by a
 * town's name. Create and the weather page are told the region and country by their own place search.
 */

/** The point as a place for Create or the weather page: its coordinates, and the town it is in when it is in one */
export function placeRefOf(point: Pick<AtlasPoint, "cell" | "place">): PlaceRef {
  const town = point.place?.place ?? point.place?.district;
  const inside = (point.place?.nearKm ?? 0) < NEAR_KM;
  return { lat: point.cell.lat, lon: point.cell.lon, ...(town && inside ? { name: town } : {}) };
}

/** The Atlas opened on a place: its cell, as the address of a free point has it */
export function atlasHref(place: { lat: number; lon: number }): string {
  return `/atlas?lat=${place.lat.toFixed(2)}&lon=${place.lon.toFixed(2)}`;
}
