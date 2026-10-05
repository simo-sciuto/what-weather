import { COORD_PRECISION } from "./constants";

/**
 * A coordinate rounded to the cache's precision (~1 km): the page's cache key and every provider's request round
 * it the same way, so one place is one entry (ADR-003). Written once so the two can never drift apart.
 */
export const roundCoord = (n: number) => Number(n.toFixed(COORD_PRECISION));
