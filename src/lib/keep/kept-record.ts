import { MAX_INSTANT, MIN_INSTANT } from "@/constants/moment";
import { samePlace } from "@/lib/place";
import type { SavedPlace } from "@/lib/saved-places";
import type { CreateFormat } from "@/lib/record/create-record";
import type { PlaceRef } from "@/types/place";

/**
 * What Keep holds (ADR-028): a place, a moment, a format and a thumbnail. Not the poster itself: the file is drawn
 * again from the moment when it is wanted, so what stays on the device is small. Not `CreateRecord`, which is the
 * poster's own versioned specification (WTH-234); a kept record only remembers what to ask for.
 *
 * Pure: no storage, no clock, no React. The store that reads and writes them is `kept-store.ts`.
 */

export const KEPT_VERSION = 1;

/** The most records kept: a thumbnail is a few kilobytes, so this stays far below the storage limit */
export const MAX_KEPT = 24;

/** The longest thumbnail accepted, in characters of its data URL: one that big is not a thumbnail */
export const MAX_THUMB_CHARS = 24_000;

export type KeptPlace = PlaceRef & { name: string };

export type KeptRecord = {
  /** Stable for the record's life; the address of an open record (`#record=<id>`) */
  id: string;
  place: KeptPlace;
  /** Unix seconds of the moment, or null for "Adesso": the record follows the clock when it is read again */
  t: number | null;
  format: CreateFormat;
  /** Unix seconds */
  createdAt: number;
  /** A small image as a data URL; absent when it could not be made or did not fit */
  thumb?: string;
};

export const DEFAULT_KEPT_FORMAT: CreateFormat = "a4";

const FORMATS: readonly CreateFormat[] = ["a4", "story", "square"];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** The id of a record made at `createdAt`: time in base 36 and a suffix, so two made in the same second differ */
export function newRecordId(createdAt: number, suffix: string): string {
  return `r${Math.floor(createdAt).toString(36)}${suffix}`;
}

/** The id a migrated saved place gets: from where it is, so migrating twice makes the same one */
export function savedPlaceId(place: Pick<PlaceRef, "lat" | "lon">): string {
  return `p${place.lat.toFixed(2)}_${place.lon.toFixed(2)}`;
}

/** A record read from storage, or null when it is not one (a malformed entry is dropped, never repaired by guessing) */
export function parseKept(raw: unknown): KeptRecord | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id || raw.id.length > 64) return null;
  const place = raw.place;
  if (!isRecord(place) || !finite(place.lat) || !finite(place.lon)) return null;
  if (Math.abs(place.lat) > 90 || Math.abs(place.lon) > 180) return null;
  if (typeof place.name !== "string" || !place.name.trim()) return null;
  if (raw.t !== null && !(Number.isInteger(raw.t) && (raw.t as number) >= MIN_INSTANT && (raw.t as number) <= MAX_INSTANT)) return null;
  if (typeof raw.format !== "string" || !FORMATS.includes(raw.format as CreateFormat)) return null;
  if (!finite(raw.createdAt)) return null;
  const thumb = typeof raw.thumb === "string" && raw.thumb.length <= MAX_THUMB_CHARS && raw.thumb.startsWith("data:image/") ? raw.thumb : undefined;
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
  return {
    id: raw.id,
    place: {
      lat: place.lat,
      lon: place.lon,
      name: place.name.trim().slice(0, 80),
      ...(text(place.region, 80) ? { region: text(place.region, 80) } : {}),
      ...(text(place.country, 3) ? { country: text(place.country, 3) } : {}),
    },
    t: raw.t as number | null,
    format: raw.format as CreateFormat,
    createdAt: raw.createdAt,
    ...(thumb ? { thumb } : {}),
  };
}

/**
 * A saved place as a record of "Adesso" (ADR-028): the place and no moment, the default format, no thumbnail. Made
 * at `createdAt`, which the caller gives, so that a migration is the same each time it runs.
 */
export function recordFromSaved(place: SavedPlace, createdAt: number): KeptRecord {
  return {
    id: savedPlaceId(place),
    place: {
      lat: place.lat,
      lon: place.lon,
      name: place.name,
      ...(place.region ? { region: place.region } : {}),
      ...(place.country ? { country: place.country } : {}),
    },
    t: null,
    format: DEFAULT_KEPT_FORMAT,
    createdAt,
  };
}

/**
 * The saved places as records, oldest first, the first one made at `createdAt` and each next one a second later: the
 * list order of the saved places (the last saved is the newest) survives as the order of `createdAt`. Two places that
 * are the same to the hundredth of a degree make one record (the first), so an id is never twice in the list.
 */
export function recordsFromSaved(places: SavedPlace[], createdAt: number): KeptRecord[] {
  const seen = new Set<string>();
  return places
    .filter((p) => {
      const id = savedPlaceId(p);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((p, i) => recordFromSaved(p, createdAt + i));
}

/** The list with `record` added as the newest: one of the same id is replaced, the oldest go when there are too many */
export function withRecord(list: KeptRecord[], record: KeptRecord, max: number = MAX_KEPT): KeptRecord[] {
  return [...list.filter((r) => r.id !== record.id), record].sort((a, b) => a.createdAt - b.createdAt).slice(-max);
}

/** The list without the record of that id */
export function withoutRecord(list: KeptRecord[], id: string): KeptRecord[] {
  return list.filter((r) => r.id !== id);
}

/** The newest first, as Keep shows them */
export function newestFirst(list: KeptRecord[]): KeptRecord[] {
  return [...list].sort((a, b) => b.createdAt - a.createdAt);
}

/** The record of "Adesso" at a place, if one is kept: a place saved before records, or kept as the current moment */
export function liveRecordAt(list: KeptRecord[], place: Pick<PlaceRef, "lat" | "lon">): KeptRecord | undefined {
  return list.find((r) => r.t === null && samePlace(r.place, place));
}
