import { DAY_SECONDS, HOUR_SECONDS, MINUTE_SECONDS } from "./time";

/** OpenWeather refreshes One Call 4.0 every 10 minutes; we cache on the same cadence. */
export const WEATHER_REVALIDATE_SECONDS = 10 * MINUTE_SECONDS;

/**
 * A cached reading older than this is not shown. After a long idle period the
 * cache serves its last entry once (stale-while-revalidate); for weather that
 * could be days old, so we bypass the cache and fetch again instead.
 */
export const MAX_DATA_AGE_SECONDS = HOUR_SECONDS;

/** How long a cached weather entry may be served stale while it refreshes in the background. */
export const WEATHER_STALE_SECONDS = 5 * MINUTE_SECONDS;

/** Place names practically never change. */
export const GEOCODE_REVALIDATE_SECONDS = 7 * DAY_SECONDS;

/** A place search is asked again after a day. */
export const PLACES_REVALIDATE_SECONDS = DAY_SECONDS;

/** Coordinates are rounded to ~1 km so nearby requests share one cache entry. */
export const COORD_PRECISION = 2;

/** The cloud grid sits on a fixed lattice: one entry per hour, dropped after two. */
export const CLOUD_GRID_REVALIDATE_SECONDS = HOUR_SECONDS;
export const CLOUD_GRID_EXPIRE_SECONDS = 2 * HOUR_SECONDS;
/** The browser forgets a place's cloud grid after the grid's own hour (in milliseconds). */
export const CLOUD_CLIENT_MEMO_MS = CLOUD_GRID_REVALIDATE_SECONDS * 1000;

/** Places don't move: a month between checks, a year before a fact is dropped. */
export const CITY_FACTS_REVALIDATE_SECONDS = 30 * DAY_SECONDS;
export const CITY_FACTS_EXPIRE_SECONDS = 365 * DAY_SECONDS;

/** The Cache-Control of each of our routes, as the browser and the CDN read it. */
export const CACHE_CONTROL = {
  places: "public, max-age=3600, stale-while-revalidate=86400",
  summary: "public, max-age=300, stale-while-revalidate=600",
  clouds: "public, max-age=900, stale-while-revalidate=3600",
  og: "public, max-age=600, stale-while-revalidate=3600",
  /** An answer that is different every time */
  noStore: "no-store",
} as const;
