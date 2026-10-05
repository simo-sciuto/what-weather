import type { PlaceRef } from "@/types/place";

/**
 * Picking one city out of the places GeoNames numbers return: only the populated places that exist today.
 * (The draw of the numbers is `drawRandomCity`, in lib/api/sources/random-city.ts.)
 */

/** A GeoNames place as Open-Meteo returns it (only what is used) */
export type GeoPlace = {
  name?: string;
  latitude?: number;
  longitude?: number;
  feature_code?: string;
  country_code?: string;
  admin1?: string;
  population?: number;
};

/** Populated places that exist today: not historical, abandoned, destroyed, or a part of one */
const POPULATED = /^PPL(A\d?|C|G)?$/;

/** One of the populated places among the candidates, drawn at random, as a place to open; null if none is. */
export function pickCity(
  candidates: readonly GeoPlace[],
  random: () => number = Math.random,
): PlaceRef | null {
  const populated = candidates.filter(
    (c) =>
      c.name &&
      typeof c.latitude === "number" &&
      typeof c.longitude === "number" &&
      c.feature_code &&
      POPULATED.test(c.feature_code),
  );
  const chosen = populated[Math.floor(random() * populated.length)];
  if (!chosen) return null;
  return {
    name: chosen.name,
    lat: chosen.latitude as number,
    lon: chosen.longitude as number,
    region: chosen.admin1,
    country: chosen.country_code,
  };
}
