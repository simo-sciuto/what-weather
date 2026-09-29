"use client";

import { samePlace } from "@/lib/place";
import { addSaved, parseSaved, removeSaved, savedSnapshot, subscribeSaved, type SavedPlace } from "@/lib/saved-places";
import type { Place } from "@/lib/weather/types";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";

/**
 * The place on show, the search field that changes it, and the places saved
 * in this browser. The search (header), the place name (reading) and the
 * saved-place cards (below the week) all read from here: the saved list is
 * parsed once for all of them, and the name hands focus to the field through
 * the shared ref rather than by looking it up in the document.
 */
interface PlaceState {
  place: Place;
  /** Attached to the search field */
  searchRef: RefObject<HTMLInputElement | null>;
  focusSearch: () => void;
  /** Saved in this browser; empty on the server */
  saved: SavedPlace[];
  /** Whether the place on show is among them */
  isSaved: boolean;
  toggleSaved: () => void;
}

const PlaceContext = createContext<PlaceState | null>(null);

export function PlaceProvider({ place, children }: { place: Place; children: ReactNode }) {
  const searchRef = useRef<HTMLInputElement>(null);
  const focusSearch = useCallback(() => searchRef.current?.focus(), []);

  // Saved places live in the browser; the server renders an empty list.
  const savedRaw = useSyncExternalStore(subscribeSaved, savedSnapshot, () => "[]");
  const saved = useMemo(() => parseSaved(savedRaw), [savedRaw]);
  const isSaved = useMemo(() => saved.some((p) => samePlace(p, place)), [saved, place]);

  const toggleSaved = useCallback(() => {
    const ref = { lat: place.lat, lon: place.lon, name: place.name, region: place.region, country: place.country };
    if (isSaved) removeSaved(ref);
    else addSaved(ref);
  }, [place, isSaved]);

  const value = useMemo(
    () => ({ place, searchRef, focusSearch, saved, isSaved, toggleSaved }),
    [place, focusSearch, saved, isSaved, toggleSaved],
  );
  return <PlaceContext.Provider value={value}>{children}</PlaceContext.Provider>;
}

export function usePlace(): PlaceState {
  const ctx = useContext(PlaceContext);
  if (!ctx) throw new Error("usePlace must be used inside <PlaceProvider>");
  return ctx;
}
