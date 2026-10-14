import { roundCoord } from "@/lib/weather/coordinates";
import type { Cell } from "@/types/atlas";

/**
 * The map's centre as a cell: coordinates rounded to the cache's precision (about a kilometre), so a cell is both what
 * the cache is keyed on and what is shown as the point's coordinates (ADR-003). The longitude is brought into
 * [-180, 180) and rounded after that, 180 itself being -180: the map may go round the world and report 200 for -160,
 * and 179.996 and -179.996 are one cell, not two cache keys.
 */
export function cellOf(lng: number, lat: number): Cell {
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180;
  let lon = roundCoord(wrapped);
  if (lon >= 180) lon -= 360;
  return { lat: roundCoord(lat), lon };
}

/** The same cell (compared as numbers, so -0 and 0 are one) */
export function sameCell(a: Cell | null, b: Cell | null): boolean {
  return a !== null && b !== null && a.lat === b.lat && a.lon === b.lon;
}
