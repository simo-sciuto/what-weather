import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cookies } from "next/headers";
import { LAST_PLACE_COOKIE, parsePlaceCookie, parsePlaceRef, type PlaceRef } from "./place";
import { DEFAULT_PLACE, getProvider } from "./weather";
import { COORD_PRECISION, MAX_DATA_AGE_SECONDS, WEATHER_REVALIDATE_SECONDS } from "./weather/constants";
import { buildTimeline } from "./weather/frames";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const param = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);
const round = (n: number) => Number(n.toFixed(COORD_PRECISION));

/**
 * The weather for one place, fetched and worked out (timeline, palettes,
 * sentences) once and shared by every visitor asking for that place, for as
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

  const fetched = await provider.getByCoords(lat, lon);
  // A name picked in search beats reverse geocoding ("Tokyo" rather than "Shibuya").
  const data = name
    ? { ...fetched, place: { ...fetched.place, name, region, country: country ?? fetched.place.country } }
    : fetched;
  return { data, timeline: buildTimeline(data), provider: provider.name };
}

/**
 * The weather for a place, through the shared cache. Used by the page and by
 * everything else that shows a place's weather (the share image, the radar,
 * the saved places), so they all reuse one entry per place.
 */
export function weatherFor(ref: PlaceRef, scenario?: string, at?: string) {
  return load(round(ref.lat), round(ref.lon), ref.name, ref.region, ref.country, scenario, at);
}

/** Reads the request (URL, then the last-place cookie), then loads through the cache. */
export async function loadWeatherPage(searchParams: SearchParams) {
  const params = await searchParams;
  // The URL wins; otherwise the place chosen last time; otherwise the default.
  const ref =
    parsePlaceRef(params) ?? parsePlaceCookie((await cookies()).get(LAST_PLACE_COOKIE)?.value) ?? DEFAULT_PLACE;
  const scenario = param(params.mock);
  const at = param(params.at);
  const loaded = await weatherFor(ref, scenario, at);
  return { ...loaded, scenario, at, renderedAt: Math.floor(Date.now() / 1000) };
}
