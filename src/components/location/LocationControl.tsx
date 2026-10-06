"use client";

import { usePlace } from "./PlaceContext";

/** The place name doubles as a shortcut to the search field right above it. */
export function LocationControl() {
  const { place, focusSearch } = usePlace();
  return (
    <h1 className="leading-none">
      <button
        type="button"
        onClick={focusSearch}
        className="block rounded-md text-left decoration-white/40 underline-offset-[0.15em] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        <span
          // Syne is wide: the name a little smaller than the title row, in capitals, broken only between words
          className="display-caps block text-[0.74em] uppercase text-[var(--title)] text-balance [overflow-wrap:normal] [hyphens:none]"
        >
          {place.name}
        </span>
        <span className="sr-only">, cerca un’altra località</span>
      </button>
    </h1>
  );
}
