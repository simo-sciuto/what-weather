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

/**
 * The administrative words the Italian provinces and regions carry in front of the name ("provincia autonoma di
 * Bolzano", "città metropolitana di Torino"): on a title they are noise, and make it too long to read. Only for how a
 * level is shown; the names the geocoder gave are kept as they are.
 */
const ADMIN_PREFIX = /^(?:citt[àa] metropolitana|provincia autonoma|libero consorzio comunale|provincia|regione)\s+(?:dell['’]|della|dello|delle|degli|dei|del|di)\s*/i;
export function plainName(name: string): string {
  const prefix = ADMIN_PREFIX.exec(name);
  if (!prefix) return name;
  const rest = name.slice(prefix[0].length).trim();
  if (!rest) return name;
  // "provincia dell'Aquila" is "L'Aquila": the article belongs to the name
  return /dell['’]\s*$/i.test(prefix[0]) ? `L'${rest}` : rest;
}

export type PlaceLabel = {
  /** The title: the level the zoom asks for, or, from the quarter's zoom, the town */
  name: string;
  /** From the quarter's zoom, the quarter, below the town and as big */
  detail: string | null;
  /** The coarser names above the title's own level, nearest first, at most two */
  context: string | null;
  near: boolean;
};

export function placeLabel(given: PlaceNames | null, zoom: number): PlaceLabel | null {
  if (!given) return null;
  const place: PlaceNames = { ...given };
  for (const level of ["region", "district"] as const) if (place[level]) place[level] = plainName(place[level]!);
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
