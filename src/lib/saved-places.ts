import { parsePlaceRef, samePlace } from "./place";
import type { PlaceRef } from "@/types/place";

/**
 * Saved places live in localStorage (no accounts in the MVP), exposed as an
 * external store for useSyncExternalStore. Every access is guarded: storage
 * can be missing or throw in private windows and previews.
 */

const KEY = "weather:saved-places";
const MAX_SAVED = 12;

export type SavedPlace = PlaceRef & { name: string };

const listeners = new Set<() => void>();

export function subscribeSaved(onChange: () => void) {
  listeners.add(onChange);
  // Other tabs changing the list.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The raw stored string: a stable snapshot that only changes when the list does. */
export function savedSnapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function parseSaved(raw: string): SavedPlace[] {
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .map((r) => parsePlaceRef(r))
      .filter((p): p is SavedPlace => p !== null && typeof p.name === "string");
  } catch {
    return [];
  }
}

function write(list: SavedPlace[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable (private mode, blocked): saving silently does nothing.
  }
  listeners.forEach((l) => l());
}

export function addSaved(place: SavedPlace) {
  const list = parseSaved(savedSnapshot()).filter((p) => !samePlace(p, place));
  write([...list, place].slice(-MAX_SAVED));
}

export function removeSaved(place: PlaceRef) {
  write(parseSaved(savedSnapshot()).filter((p) => !samePlace(p, place)));
}
