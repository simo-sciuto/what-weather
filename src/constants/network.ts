/** A detail the page can do without (yesterday's comparison, pollen, a random city): a slow answer is dropped rather than waited for. */
export const OPTIONAL_FETCH_TIMEOUT_MS = 4000;

/** Nearby towns' readings: a little more room, one request for all of them. */
export const NEARBY_FETCH_TIMEOUT_MS = 6000;

/** The "Territorio" chapter: a map API answers at once, Wikidata's queries over an area take a while. */
export const MAP_API_TIMEOUT_MS = 8000;
export const WIKIDATA_TIMEOUT_MS = 15_000;
