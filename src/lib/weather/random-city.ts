import type { PlaceRef } from "../place";

/**
 * A place drawn at random from the world, without a list: GeoNames numbers every
 * place it knows, and Open-Meteo's geocoding gives a place back from its number,
 * so a random number is a random place. About six in ten numbers exist and most
 * of those are populated places, so a handful of numbers are drawn together and
 * one of the populated places among them is kept, at random: a metropolis, a
 * town or a hamlet no one has heard of, as likely as they are on the map.
 */

/** GeoNames numbers run to about this, with gaps */
const MAX_ID = 12_000_000;
/** Numbers asked about together, and how many rounds at most before giving up */
const BATCH = 30;
const ROUNDS = 3;
const ENDPOINT = "https://geocoding-api.open-meteo.com/v1/get";

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

async function lookup(id: number): Promise<GeoPlace | null> {
  try {
    const res = await fetch(`${ENDPOINT}?id=${id}&language=it`, {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as GeoPlace) : null;
  } catch {
    return null;
  }
}

/** Draws numbers until a populated place turns up; null if the service has none to give. */
export async function drawRandomCity(): Promise<PlaceRef | null> {
  for (let round = 0; round < ROUNDS; round++) {
    const ids = Array.from(
      { length: BATCH },
      () => 1 + Math.floor(Math.random() * MAX_ID),
    );
    const found = await Promise.all(ids.map(lookup));
    const city = pickCity(found.filter((p): p is GeoPlace => p !== null));
    if (city) return city;
  }
  return null;
}
