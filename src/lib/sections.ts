import { placeQuery } from "./place";
import type { PlaceRef } from "@/types/place";

/**
 * The page's three sections and where they live in the address (ADR-029). One route, `/`, shows one section at a time:
 * Meteo (the weather and the territory), Esplora (the map) and Crea (the poster). The section is the address's hash;
 * `/atlas` and `/crea` stay as entry addresses that open the same page on their own section, and are not rewritten.
 *
 * This file is the one place that knows the shape of those addresses. Pure: no window, no React.
 */

export const SECTIONS = ["meteo", "esplora", "crea"] as const;
export type Section = (typeof SECTIONS)[number];

/** The section a route opens on when the address has no hash */
export function entryOf(pathname: string): Section {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/atlas") return "esplora";
  if (path === "/crea") return "crea";
  return "meteo";
}

/** The section a hash names ("#crea"), or null when it names none of them */
export function parseSection(hash: string): Section | null {
  const name = hash.replace(/^#/, "").toLowerCase();
  return (SECTIONS as readonly string[]).includes(name) ? (name as Section) : null;
}

/** The section on show: a known hash wins, else the route's own */
export function sectionOf(pathname: string, hash: string): Section {
  return parseSection(hash) ?? entryOf(pathname);
}

/**
 * The hash that shows a section on a route. Meteo on `/` is no hash at all; on an entry route it must be written
 * (`#meteo`), as no hash there would mean Esplora or Crea. The other sections are always written, even on their own entry.
 */
export function sectionHash(pathname: string, section: Section): string {
  if (section === "meteo" && entryOf(pathname) === "meteo") return "";
  return `#${section}`;
}

/** The address of a section on the route you are on, the query kept as it is: a switch changes the hash and nothing else */
export function sectionHref(pathname: string, search: string, section: Section): string {
  const query = search.replace(/^\?/, "");
  return `${pathname}${query ? `?${query}` : ""}${sectionHash(pathname, section)}`;
}

/**
 * The place and the moment as the query every section reads: `lat`, `lon` and the names to four decimals and the
 * names, and `t` (Unix seconds) when there is a moment. One precision for all, so the sections never disagree about
 * where they are.
 */
export function journeyQuery(place: PlaceRef, t?: number | null): string {
  const q = placeQuery(place);
  return t === undefined || t === null || !Number.isInteger(t) ? q : `${q}&t=${t}`;
}

/**
 * A link to a section for somebody else, a shared one: the canonical page `/` with the section as a hash. (Inside the
 * page a switch uses `sectionHref`, on the route you are on.)
 */
export function sharedHref(section: Section, place: PlaceRef, t?: number | null): string {
  return `/?${journeyQuery(place, t)}${section === "meteo" ? "" : `#${section}`}`;
}
