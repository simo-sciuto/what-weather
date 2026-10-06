import { territoryHref } from "@/lib/place";
import type { Place } from "@/types/weather";
import Link from "next/link";

/**
 * Where the "Territorio" chapter used to stand on the weather page: one line, a hairline row that opens the place's
 * own page (what it is, the towns around, its waters and peaks). The weather page answers one question, what the sky
 * is doing; the place has its own (docs/APP_AREAS.md).
 */
export function TerritoryLink({ place }: { place: Place }) {
  return (
    <Link
      href={territoryHref(place)}
      className="sheet on-sky group flex items-baseline justify-between gap-4 rounded-sm py-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
    >
      <span className="label text-ink">Territorio</span>
      <span className="text-right text-[0.9375rem] text-ink-muted transition-colors group-hover:text-ink">
        Il luogo, i dintorni, le acque e le vette <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}
