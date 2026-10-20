import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import { parsePlaceRef } from "./place";
import type { PlaceRef } from "@/types/place";
import { getProvider } from "./api/providers/get-provider";
import { lookupPollen } from "./api/sources/pollen";
import { sinceYesterday } from "./api/sources/yesterday";
import { DEFAULT_PLACE } from "@/constants/weather";
import { MAX_DATA_AGE_SECONDS, WEATHER_REVALIDATE_SECONDS, WEATHER_STALE_SECONDS } from "@/constants/cache";
import { roundCoord } from "./weather/coordinates";
import { buildTimeline, relabelDays } from "./weather/frames";
import { needsNames, withPlaceNames } from "./weather/place-names";
import { randomPlace } from "./weather/random-places";
import { toRadians } from "@/utils/math";

export type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

const param = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

/**
 * The weather for one place, fetched and worked out (timeline, palettes,
 * sentences, the change since yesterday, the pollen) once and shared by every visitor asking for that place, for as
 * long as the forecast is fresh. Keyed on its arguments, which is why the
 * coordinates are rounded first: nearby requests land on the same entry.
 * The page, its metadata and any later request all reuse the same result. The key is the coordinates, the scenario
 * and the hour and nothing else (ADR-029): a place's name is put on after the cache (`withPlaceNames`), so a link with
 * a name and a free point on the same cell are one entry and one set of calls to the provider.
 */
async function load(lat: number, lon: number, scenario: string | undefined, at: string | undefined) {
  "use cache";
  const provider = getProvider(scenario, at);
  cacheTag(`weather:${lat},${lon}`);
  if (provider.name === "mock") {
    // Sample data simulates the clock; it must not stand still for long.
    cacheLife("seconds");
  } else {
    cacheLife({
      // OpenWeather refreshes every 10 minutes: serve the entry, refresh it in the background.
      revalidate: WEATHER_REVALIDATE_SECONDS,
      // After an idle hour the next visitor waits for a fresh forecast rather than an old one.
      expire: MAX_DATA_AGE_SECONDS,
      stale: WEATHER_STALE_SECONDS,
    });
  }

  const [weather, yesterday, pollen] = await Promise.all([
    provider.getByCoords(lat, lon),
    // Sample data has no yesterday to compare with, and brings its own pollen.
    provider.name === "mock" ? null : sinceYesterday(lat, lon),
    provider.name === "mock" ? undefined : lookupPollen(lat, lon),
  ]);
  const fetched = pollen === undefined ? weather : { ...weather, pollen };
  return {
    data: fetched,
    timeline: buildTimeline(fetched),
    provider: provider.name,
    yesterday,
  };
}

/**
 * The region and country the place search gives a name, from its result nearest these coordinates (within 30 km);
 * null if none is near. Cached on its own (the name, the coordinates, the scenario and the hour), so it is not
 * part of the weather's key (ADR-029). A place's names change rarely: an hour is long enough.
 */
async function namesFor(name: string, lat: number, lon: number, scenario: string | undefined, at: string | undefined) {
  "use cache";
  cacheLife("hours");
  // A failure is thrown, not returned as "none": a thrown error is not cached, so a search that failed once is asked again
  const found = await getProvider(scenario, at).searchPlaces(name);
  const km = (p: { lat: number; lon: number }) =>
    Math.hypot((p.lat - lat) * 111, (p.lon - lon) * 111 * Math.cos(toRadians(lat)));
  const near = found
    .filter((p) => km(p) < 30)
    .sort((a, b) => km(a) - km(b))[0];
  return near ? { region: near.region, country: near.country } : null;
}

/**
 * The weather for a place, through the shared cache. Used by the page and by
 * everything else that shows a place's weather (the share image, the radar,
 * the saved places), so they all reuse one entry per place.
 */
export async function weatherFor(ref: PlaceRef, scenario?: string, at?: string) {
  const lat = roundCoord(ref.lat);
  const lon = roundCoord(ref.lon);
  const loaded = await load(lat, lon, scenario, at);
  // The link's name, with the region and country its place search completes, goes on after the cache (ADR-029)
  const named = needsNames(ref.name, ref.region, ref.country)
    ? await namesFor(ref.name!, lat, lon, scenario, at).catch(() => null)
    : null;
  if (!ref.name) return loaded;
  return { ...loaded, data: withPlaceNames(loaded.data, ref.name, ref.region, ref.country, named) };
}

/**
 * The city a bare address lands on, drawn once per request: the page and its
 * metadata both ask, and must be told the same one.
 */
const landingPlace = cache(randomPlace);

/**
 * Where a bare address lands: on a city drawn at random (the home, ADR-017) or on the default place (the entries
 * `/crea` and `/atlas`, ADR-029: a record is made of a place somebody chose, never of a draw).
 */
export type Landing = "random" | "default";

/**
 * Reads the request (the URL), then loads through the cache. A link to a place
 * wins. A bare address lands, by `landing`, on a city drawn at random, a different one on each
 * visit, or on the default place; sample data (`?mock`, the tests) always lands on the default place,
 * so what it shows stays the same.
 */
export async function loadWeatherPage(searchParams: SearchParams, { landing = "random" }: { landing?: Landing } = {}) {
  const params = await searchParams;
  const scenario = param(params.mock);
  const at = param(params.at);
  const linked = parsePlaceRef(params);
  const landed = !linked && landing === "random" && getProvider(scenario, at).name !== "mock";
  const ref = linked ?? (landed ? landingPlace() : DEFAULT_PLACE);
  const loaded = await weatherFor(ref, scenario, at);
  const renderedAt = Math.floor(Date.now() / 1000);
  return {
    ...loaded,
    // The day names are worked out now, not when the weather was cached (WTH-249)
    timeline: relabelDays(loaded.timeline, loaded.data.timezone, renderedAt),
    scenario,
    at,
    landed,
    renderedAt,
  };
}
