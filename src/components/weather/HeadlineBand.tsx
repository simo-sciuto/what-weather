"use client";

import { useEffect, useState } from "react";
import { usePlace } from "../location/PlaceContext";
import { HeroTemp } from "../time/HeroTemp";
import { PartsNav } from "../tavola/PartsNav";

/**
 * The Testata at its small size, on a phone (ADR-028, ADR-029): once the large reading has left the screen, a band of
 * 56 px at the top keeps the place's name and its temperature in view as you scroll, with the two titles of the section,
 * Tempo and Territorio, still at hand. It watches the reading with an IntersectionObserver. The name and the figure
 * are hidden from screen readers, which have the reading itself and its heading (the name is cut to one line here, and
 * whole in the title); the titles are the band's only part to be reached, and only while it is on show.
 */
export function HeadlineBand() {
  const { place } = usePlace();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const reading = document.querySelector('[data-map-anchor="poster"]');
    if (!reading) return;
    const io = new IntersectionObserver(([entry]) => setShown(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    io.observe(reading);
    return () => io.disconnect();
  }, []);

  return (
    <div
      inert={!shown}
      data-headline-band
      data-shown={shown}
      title={place.name}
      className="band-surface fixed inset-x-0 top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between gap-3 border-b border-white/50 px-5 pt-[env(safe-area-inset-top)] transition-[transform,opacity] duration-200 ease-[cubic-bezier(.2,.7,.2,1)] data-[shown=false]:pointer-events-none data-[shown=false]:-translate-y-full data-[shown=false]:opacity-0 sm:px-8 lg:hidden"
    >
      <p aria-hidden="true" className="min-w-0 flex-1 truncate text-[1.25rem] font-extrabold leading-none tracking-[-0.04em] text-[var(--title)]">
        {place.name}
      </p>
      <div aria-hidden="true">
        <HeroTemp size="band" />
      </div>
      <PartsNav size="band" />
    </div>
  );
}
