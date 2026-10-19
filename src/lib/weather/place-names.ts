import type { WeatherData } from "@/types/weather";

/**
 * A place's names, applied to the weather of its coordinates after the cache (ADR-029). The weather is cached on the
 * coordinates, the scenario and the hour only, so a link with a name and a free point on the same cell share one entry;
 * the names a link carries (and the region and country its place search completes) are put on afterwards, here.
 *
 * Pure: no cache, no network. The timeline is built from the weather without these names, which it does not read
 * (see place-names.test.ts), so it can stay in the cache.
 */

export type NamedPlace = { region?: string; country?: string };

/** Whether the place search is needed: a name was given and the region or the country was not */
export function needsNames(name: string | undefined, region: string | undefined, country: string | undefined): boolean {
  return Boolean(name) && (!region || !country);
}

/**
 * The weather with the link's name in place of the provider's, its region and country taken from the link, else from
 * the place search (`named`), else the provider's own. Without a name the weather is returned as it is.
 */
export function withPlaceNames(
  data: WeatherData,
  name: string | undefined,
  region: string | undefined,
  country: string | undefined,
  named: NamedPlace | null,
): WeatherData {
  if (!name) return data;
  return {
    ...data,
    place: {
      ...data.place,
      name,
      region: region ?? named?.region ?? data.place.region,
      country: country ?? named?.country ?? data.place.country,
    },
  };
}
