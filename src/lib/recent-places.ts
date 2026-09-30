import { samePlace } from "./place";
import { parseSaved, type SavedPlace } from "./saved-places";

/**
 * The places looked at lately, newest first, kept in localStorage like the
 * saved ones (see saved-places.ts) and exposed the same way, as an external
 * store. Every place the page shows is noted, however it was reached (the
 * search, a saved place, a town nearby, a shared link).
 */

const KEY = "weather:recent-places";
const MAX_RECENT = 6;

const listeners = new Set<() => void>();

export function subscribeRecent(onChange: () => void) {
  listeners.add(onChange);
  // Other tabs changing the list.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The raw stored string: a stable snapshot that only changes when the list does. */
export function recentSnapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function write(list: SavedPlace[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable (private mode, blocked): nothing is remembered.
  }
  listeners.forEach((l) => l());
}

/** Puts the place first, once. Already first: nothing to write. */
export function noteRecent(place: SavedPlace) {
  const list = parseSaved(recentSnapshot());
  if (list[0] && samePlace(list[0], place) && list[0].name === place.name) return;
  write([place, ...list.filter((p) => !samePlace(p, place))].slice(0, MAX_RECENT));
}

export function clearRecent() {
  write([]);
}
