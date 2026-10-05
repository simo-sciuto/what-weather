import "server-only";
import type { PlaceRef } from "@/types/place";
import { pickCity, type GeoPlace } from "@/lib/weather/random-city";

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
