import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import { parsePlaceRef } from "./place";
import type { PlaceRef } from "@/types/place";
import { getProvider } from "./api/providers/get-provider";
import { lookupPollen } from "./api/sources/pollen";
import { sinceYesterday } from "./api/sources/yesterday";
import {
  DEFAULT_PLACE,
  MAX_DATA_AGE_SECONDS,
  WEATHER_REVALIDATE_SECONDS,
} from "./weather/constants";
import { roundCoord } from "./weather/coordinates";
import { buildTimeline } from "./weather/frames";
import { randomPlace } from "./weather/random-places";

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
 * The page, its metadata and any later request all reuse the same result.
 */
async function load(
  lat: number,
  lon: number,
  name: string | undefined,
  region: string | undefined,
  country: string | undefined,
  scenario: string | undefined,
  at: string | undefined,
) {
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
      stale: 5 * 60,
    });
  }

  const [weather, yesterday, pollen] = await Promise.all([
    provider.getByCoords(lat, lon),
    // Sample data has no yesterday to compare with, and brings its own pollen.
    provider.name === "mock" ? null : sinceYesterday(lat, lon),
    provider.name === "mock" ? undefined : lookupPollen(lat, lon),
  ]);
  const fetched = pollen === undefined ? weather : { ...weather, pollen };
  // A link that gives only the name (a town nearby, a random city) is told its region and country by the
  // place search, the result nearest these coordinates; reverse geocoding may know neither (Open-Meteo
  // has none) or name the spot differently ("Urawa Ward" for Saitama).
  const named =
    name && (!region || !country)
      ? await namesFor(provider, name, lat, lon)
      : null;
  const data = name
    ? {
        ...fetched,
        place: {
          ...fetched.place,
          name,
          region: region ?? named?.region ?? fetched.place.region,
          country: country ?? named?.country ?? fetched.place.country,
        },
      }
    : fetched;
  return {
    data,
    timeline: buildTimeline(data),
    provider: provider.name,
    yesterday,
  };
}

/** The region and country the place search gives a name, from its result nearest these coordinates (within 30 km); null if none is near. */
async function namesFor(
  provider: ReturnType<typeof getProvider>,
  name: string,
  lat: number,
  lon: number,
) {
  try {
    const found = await provider.searchPlaces(name);
    const km = (p: { lat: number; lon: number }) =>
      Math.hypot(
        (p.lat - lat) * 111,
        (p.lon - lon) * 111 * Math.cos((lat * Math.PI) / 180),
      );
    const near = found
      .filter((p) => km(p) < 30)
      .sort((a, b) => km(a) - km(b))[0];
    return near ? { region: near.region, country: near.country } : null;
  } catch {
    return null;
  }
}

/**
 * The weather for a place, through the shared cache. Used by the page and by
 * everything else that shows a place's weather (the share image, the radar,
 * the saved places), so they all reuse one entry per place.
 */
export function weatherFor(ref: PlaceRef, scenario?: string, at?: string) {
  return load(
    roundCoord(ref.lat),
    roundCoord(ref.lon),
    ref.name,
    ref.region,
    ref.country,
    scenario,
    at,
  );
}

/**
 * The city a bare address lands on, drawn once per request: the page and its
 * metadata both ask, and must be told the same one.
 */
const landingPlace = cache(randomPlace);

/**
 * Reads the request (the URL), then loads through the cache. A link to a place
 * wins. A bare address lands on a city drawn at random, a different one on each
 * visit; sample data (`?mock`, the tests) always lands on the default place,
 * so what it shows stays the same.
 */
export async function loadWeatherPage(searchParams: SearchParams) {
  const params = await searchParams;
  const scenario = param(params.mock);
  const at = param(params.at);
  const linked = parsePlaceRef(params);
  const landed = !linked && getProvider(scenario, at).name !== "mock";
  const ref = linked ?? (landed ? landingPlace() : DEFAULT_PLACE);
  const loaded = await weatherFor(ref, scenario, at);
  return {
    ...loaded,
    scenario,
    at,
    landed,
    renderedAt: Math.floor(Date.now() / 1000),
  };
}
