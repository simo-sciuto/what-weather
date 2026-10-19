"use client";

import { atlasHref } from "@/lib/atlas/links";
import Link from "next/link";
import { usePlace } from "../location/PlaceContext";

/**
 * EXPLORE's way into the map, at the head of the day's data: the Atlas opened on the place on show, where the weather
 * of every place round it is a colour and the map is free to move.
 */
export function ExploreCard() {
  const { place } = usePlace();
  return (
    <Link
      href={atlasHref(place)}
      data-explore-card
      className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-3xl border border-white/15 bg-white/6 px-5 py-4 text-ink shadow-[inset_0_0.5px_0_rgb(255_255_255/0.35)] backdrop-blur-[6px] transition-[border-color,background-color] hover:border-accent/60 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-[radial-gradient(circle,rgb(156_224_247/0.55),transparent_70%)] blur-xl transition-transform duration-500 group-hover:scale-125" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-12 right-16 size-36 rounded-full bg-[radial-gradient(circle,rgb(254_200_156/0.5),transparent_70%)] blur-xl transition-transform duration-500 group-hover:scale-125" />
      <span className="relative min-w-0">
        <span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-ink-muted">Esplora la mappa</span>
        <span className="mt-1 block text-[1.125rem] font-semibold leading-snug tracking-[-0.01em]">Muoviti: il meteo cambia da un luogo all&apos;altro, e i colori con lui.</span>
      </span>
      <span aria-hidden="true" className="relative shrink-0 font-sans text-2xl text-accent transition-transform group-hover:translate-x-1">
        →
      </span>
    </Link>
  );
}
