"use client";

import { fetchRandomPlace } from "@/lib/api/random-place";
import { fetchSummary } from "@/lib/api/summary";
import { placeHref, samePlace } from "@/lib/place";
import type { SavedPlace } from "@/lib/saved-places";
import type { PlaceSummary } from "@/types/place";
import { formatTemp } from "@/lib/weather/formatters";
import type { Condition } from "@/lib/weather/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useHydrated } from "../useHydrated";
import { WeatherIcon } from "../weather/WeatherIcon";
import { usePlace } from "./PlaceContext";

const keyOf = (p: SavedPlace) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;

/**
 * The places saved in this browser, as a compact row of pills under the
 * search: each in its own sky, with its icon and temperature right now; a
 * tap opens it, and the one on show is marked. Swipe (or scroll) for more;
 * "+" saves the place on show, or opens the search to add another. Saved
 * places only exist in the browser, so the server and the first paint show
 * placeholder pills of the same height: nothing moves when they fill in.
 */
export function SavedPlaces() {
  const { place, saved, isSaved, toggleSaved, focusSearch } = usePlace();
  const hydrated = useHydrated();
  const [summaries, setSummaries] = useState<
    Record<string, PlaceSummary | null>
  >({});
  const router = useRouter();
  const [drawing, startDrawing] = useTransition();

  useEffect(() => {
    let alive = true;
    for (const p of saved) {
      fetchSummary(p).then((s) => {
        if (alive)
          setSummaries((prev) =>
            prev[keyOf(p)] === s ? prev : { ...prev, [keyOf(p)]: s },
          );
      });
    }
    return () => {
      alive = false;
    };
  }, [saved]);

  const pill =
    "flex h-9 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap";

  if (!hydrated) {
    return (
      <div aria-hidden="true" className="flex gap-2 overflow-hidden">
        {[30, 24, 18].map((w, i) => (
          <div
            key={w}
            className={`skeleton h-9 shrink-0 rounded-full ${i > 0 ? "max-lg:hidden" : ""}`}
            style={{ width: `${w * 0.25}rem` }}
          />
        ))}
      </div>
    );
  }

  return (
    <ul
      aria-label="Città salvate"
      className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 [scrollbar-width:none] sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
    >
      <li className="shrink-0 snap-start">
        <button
          type="button"
          disabled={drawing}
          onClick={() =>
            startDrawing(async () => {
              const city = await fetchRandomPlace();
              if (city) router.push(placeHref(city));
            })
          }
          className={`${pill} border-white/15 text-ink-muted transition-colors hover:border-white/50 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60`}
        >
          <span aria-hidden="true">↻</span>
          Città casuale
        </button>
      </li>
      {saved.map((p) => {
        const s = summaries[keyOf(p)];
        const current = samePlace(p, place);
        return (
          // On a phone the poster right under the row already names the place on show, so its pill steps aside
          <li
            key={keyOf(p)}
            // On a phone only the random city stays out: the saved places are in the search
            className="shrink-0 snap-start max-lg:hidden"
          >
            <Link
              href={placeHref(p)}
              aria-current={current ? "location" : undefined}
              className={`${pill} transition-colors hover:border-white/50 focus-visible:outline-2 focus-visible:outline-accent ${
                current ? "border-accent/80" : "border-white/15"
              } ${s === undefined ? "skeleton" : ""}`}
              style={
                s
                  ? {
                      backgroundImage: `linear-gradient(120deg, ${s.sky[0]}, ${s.sky[2]})`,
                    }
                  : undefined
              }
            >
              {s && (
                <WeatherIcon
                  condition={s.condition as Condition}
                  night={s.night}
                  colored
                  className="size-5"
                />
              )}
              <span className="font-medium">{p.name}</span>
              {s ? (
                <span className="tabular-nums text-ink-muted">
                  {formatTemp(s.temp)}
                  <span className="sr-only">, {s.label.toLowerCase()}</span>
                </span>
              ) : s === null ? (
                <span className="sr-only">, meteo non disponibile</span>
              ) : null}
            </Link>
          </li>
        );
      })}
      <li className="shrink-0 snap-start max-lg:hidden">
        <button
          type="button"
          onClick={isSaved ? focusSearch : toggleSaved}
          className={`${pill} border-dashed border-white/30 text-ink-muted transition-colors hover:border-white/60 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent`}
        >
          <span aria-hidden="true">+</span>
          {isSaved
            ? saved.length > 1
              ? "Aggiungi"
              : "Aggiungi una città"
            : `Salva ${place.name}`}
        </button>
      </li>
    </ul>
  );
}
