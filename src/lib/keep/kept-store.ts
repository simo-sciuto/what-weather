import { parseSaved } from "@/lib/saved-places";
import {
  KEPT_VERSION,
  parseKept,
  recordsFromSaved,
  withRecord,
  withoutRecord,
  type KeptRecord,
} from "./kept-record";

/**
 * Where kept records live: localStorage (no accounts, ADR-028), as an external store for `useSyncExternalStore`
 * once the Keep station reads it. Every access is guarded: storage can be missing or throw in private windows and
 * previews, and can be full. The storage is passed in, so the logic runs under test without a browser.
 *
 * The saved places of before ("weather:saved-places") are read once into records and never deleted by this module:
 * the old key stays until the new one has been read back, and a later release may remove it.
 *
 * What is stored is never written over blind: a value in a newer version than this code knows, or one that cannot be
 * read at all, is left exactly as it is (a write is refused), so an older build can never erase what a newer one kept.
 */

export const KEPT_KEY = "weather:kept";
export const SAVED_KEY = "weather:saved-places";

/** The part of `Storage` this module uses */
export type KeptStorage = Pick<Storage, "getItem" | "setItem">;

type Stored = { v: number; records: unknown[] };

/**
 *  - `missing`: nothing stored yet (records have never been made on this device);
 *  - `ok`: the records, those that are not records dropped;
 *  - `corrupt`: stored, but not something this code can read (broken JSON, the wrong shape): read as empty, and a
 *    write replaces it, as there is nothing in it to keep;
 *  - `newer`: written by a newer version of the code: read as empty here, and never written over;
 *  - `blocked`: the storage cannot be read (private window, blocked site data): nothing is migrated or written.
 */
type Read =
  | { status: "missing" }
  | { status: "ok"; records: KeptRecord[] }
  | { status: "corrupt" }
  | { status: "newer" }
  | { status: "blocked" };

function read(storage: KeptStorage): Read {
  let raw: string | null;
  try {
    raw = storage.getItem(KEPT_KEY);
  } catch {
    return { status: "blocked" };
  }
  if (raw === null) return { status: "missing" };
  try {
    const data = JSON.parse(raw) as Partial<Stored> | null;
    if (!data || typeof data !== "object" || typeof data.v !== "number" || !Array.isArray(data.records)) return { status: "corrupt" };
    if (data.v > KEPT_VERSION) return { status: "newer" };
    return { status: "ok", records: data.records.map(parseKept).filter((r): r is KeptRecord => r !== null) };
  } catch {
    return { status: "corrupt" };
  }
}

/** The raw stored string, a snapshot that only changes when the records do (for `useSyncExternalStore`) */
export function keptSnapshot(storage: KeptStorage): string {
  try {
    return storage.getItem(KEPT_KEY) ?? "";
  } catch {
    return "";
  }
}

/** The kept records, oldest first: empty when there are none, nothing is stored, or storage cannot be read */
export function readKept(storage: KeptStorage): KeptRecord[] {
  const r = read(storage);
  return r.status === "ok" ? r.records : [];
}

function put(storage: KeptStorage, list: KeptRecord[]): boolean {
  const attempt = (records: KeptRecord[]) => {
    try {
      storage.setItem(KEPT_KEY, JSON.stringify({ v: KEPT_VERSION, records } satisfies Stored));
      return true;
    } catch {
      return false;
    }
  };
  if (attempt(list)) return true;
  // It does not fit: the records without their images, once more
  return attempt(list.map(({ thumb: _thumb, ...rest }) => rest));
}

/**
 * Writes the list, unless what is stored must not be written over (a newer version, or storage that cannot be read).
 * When it does not fit (a full disk, a blocked storage), the thumbnails are dropped and it is tried once more, so
 * the records survive without their images; if that fails too, nothing is written. `false` says the keeping did
 * not happen: the poster is still downloaded.
 */
export function writeKept(storage: KeptStorage, list: KeptRecord[]): boolean {
  const state = read(storage).status;
  if (state === "newer" || state === "blocked") return false;
  return put(storage, list);
}

export function addKept(storage: KeptStorage, record: KeptRecord): boolean {
  return writeKept(storage, withRecord(readKept(storage), record));
}

export function removeKept(storage: KeptStorage, id: string): boolean {
  return writeKept(storage, withoutRecord(readKept(storage), id));
}

/**
 * Brings the saved places of before into the records, once. Does nothing when records were ever made here (even if
 * none are left: a person who removed them all does not get them back), when the stored records cannot be read or are
 * from a newer version, or when there are no saved places. The saved places are read and left where they are.
 * Returns the records now stored.
 */
export function migrateSavedPlaces(storage: KeptStorage, nowSeconds: number): KeptRecord[] {
  const existing = read(storage);
  if (existing.status === "ok") return existing.records;
  // Anything stored but unreadable, newer, or unreachable is not ours to replace
  if (existing.status !== "missing") return [];
  let raw: string | null = null;
  try {
    raw = storage.getItem(SAVED_KEY);
  } catch {
    return [];
  }
  if (raw === null) return [];
  const records = recordsFromSaved(parseSaved(raw), nowSeconds);
  if (records.length === 0) return [];
  // Written only if it can be: a failed write leaves the saved places to be migrated again next time
  return put(storage, records) ? records : [];
}
