"use client";

import { atlasHref } from "@/lib/atlas/links";
import Link from "next/link";
import { usePlace } from "../location/PlaceContext";

/**
 * The way from the weather page to the Atlas, "Esplora la mappa": the map opened on the place on show, free to move
 * from there (the path Explore, Atlas, Create). `compact` is the small form for a sheet on a phone.
 */
export function AtlasLink({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const { place } = usePlace();
  return (
    <Link
      href={atlasHref(place)}
      className={
        compact
          ? `text-ink-muted underline decoration-white/35 underline-offset-4 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${className}`
          : `group inline-flex items-baseline gap-3 text-left font-display text-[0.9375rem] font-medium leading-none tracking-[-0.02em] text-ink transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:text-xl ${className}`
      }
    >
      Esplora la mappa
      {compact ? null : (
        <span aria-hidden="true" className="hidden font-sans text-base 2xl:inline font-normal text-ink-muted transition-[transform,color] group-hover:translate-x-1 group-hover:text-accent">
          →
        </span>
      )}
    </Link>
  );
}
