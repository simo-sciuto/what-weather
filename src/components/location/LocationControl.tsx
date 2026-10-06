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
          // The size comes from the title row it sits in, shared with the temperature (see WeatherHero).
          className="display-caps block text-[var(--title)] text-balance [overflow-wrap:anywhere]"
        >
          {place.name}
        </span>
        <span className="sr-only">, cerca un’altra località</span>
      </button>
    </h1>
  );
}
