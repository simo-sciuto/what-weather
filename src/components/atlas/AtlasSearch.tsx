"use client";

import { fetchPlaces } from "@/lib/api/places";
import { placeSubtitle } from "@/lib/weather/formatters";
import type { Place } from "@/types/weather";
import { useEffect, useId, useRef, useState } from "react";
import { SearchIcon } from "../location/LocationSearch";

type Results = { query: string; status: "loading" | "done" | "error"; places: Place[] };

/** The same city from two sources is one: by name, region and country */
const dedupe = (places: Place[]) => {
  const seen = new Set<string>();
  return places.filter((p) => {
    const key = `${p.name}|${p.region ?? ""}|${p.country}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * The search of a city in the Atlas (WTH-274): a round button at the top right, in the home page's glass, that opens
 * the home's field (same places route, same words) over it. Choosing a result, or pressing Enter before the results
 * have come (the first one is taken as soon as it is known), hands the place to `onChoose`, which starts the flight at
 * once. No recent or saved places here: the Atlas is a map, not a list.
 */
export function AtlasSearch({ onChoose, onOpen }: { onChoose: (place: Place) => void; onOpen?: () => void }) {
  const ids = { list: useId(), input: useId() };
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  /** Enter was pressed before the results came: the first one is chosen when they do */
  const wantFirst = useRef(false);
  /** The field is closing and the keyboard goes back to the button, which is there only once it has closed */
  const refocus = useRef(false);

  const q = query.trim();
  const mine = open && q.length >= 2 && results?.query === q ? results : null;
  const options = mine?.status === "done" ? mine.places : [];

  function choose(place: Place) {
    wantFirst.current = false;
    setOpen(false);
    setQuery("");
    setResults(null);
    refocus.current = true;
    onChoose(place);
  }
  useEffect(() => {
    if (!open) wantFirst.current = false;
    if (!open && refocus.current) {
      refocus.current = false;
      button.current?.focus();
    }
  }, [open]);

  const chooseRef = useRef(choose);
  useEffect(() => {
    chooseRef.current = choose;
  });

  useEffect(() => {
    if (!open || q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setResults({ query: q, status: "loading", places: [] });
      try {
        const places = dedupe(await fetchPlaces(q, controller.signal));
        // answered for a query that is no longer the one in the field: not shown, and never chosen
        if (controller.signal.aborted) return;
        setResults({ query: q, status: "done", places });
        setActive(-1);
        if (wantFirst.current && places.length) chooseRef.current(places[0]);
        // Enter has nothing to take: it is not left waiting for the next query
        wantFirst.current = false;
      } catch {
        if (!controller.signal.aborted) {
          wantFirst.current = false;
          setResults({ query: q, status: "error", places: [] });
        }
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, q]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && options.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp" && options.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      // an Enter that ends a composition (an input method) is not a choice
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      if (options.length) choose(options[Math.max(active, 0)]);
      else if (q.length >= 2) wantFirst.current = true;
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (query) setQuery("");
      else {
        refocus.current = true;
        setOpen(false);
      }
    }
  }

  const status =
    mine?.status === "loading"
      ? "Ricerca in corso…"
      : mine?.status === "error"
        ? "La ricerca non è disponibile. Riprova tra poco."
        : mine?.status === "done" && options.length === 0
          ? "Località non trovata. Prova con un altro nome."
          : mine?.status === "done"
            ? `${options.length} ${options.length === 1 ? "località trovata" : "località trovate"}`
            : "";

  return (
    <div
      className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-30"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      {!open ? (
        <button
          ref={button}
          type="button"
          aria-label="Cerca una località"
          onClick={() => {
            setOpen(true);
            onOpen?.();
            // the field exists on the next render: focus it then
            requestAnimationFrame(() => input.current?.focus());
          }}
          className="flex size-11 items-center justify-center rounded-full bg-white/6 text-ink shadow-[0_8px_22px_rgb(0_0_0/0.28),inset_0_0.5px_0_rgb(255_255_255/0.55),inset_0_0_0_0.5px_rgb(255_255_255/0.22)] backdrop-blur-[3px] backdrop-saturate-[1.6] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <SearchIcon className="size-5" />
        </button>
      ) : (
        <div className="w-[min(24rem,calc(100vw-2rem))]">
          <div className="flex h-12 items-center gap-3 rounded-full border border-white/20 bg-popover/90 px-4 shadow-2xl backdrop-blur-xl focus-within:border-white/40">
            <SearchIcon className="size-5 shrink-0 text-ink-muted" />
            <input
              ref={input}
              id={ids.input}
              type="text"
              role="combobox"
              aria-label="Cerca località"
              aria-expanded={options.length > 0}
              aria-controls={ids.list}
              aria-activedescendant={active >= 0 ? `${ids.list}-${active}` : undefined}
              aria-autocomplete="list"
              autoComplete="off"
              spellCheck={false}
              placeholder="Cerca un luogo"
              value={query}
              onChange={(e) => {
                // A new query is not the one Enter was pressed for
                wantFirst.current = false;
                setActive(-1);
                setQuery(e.target.value);
              }}
              onKeyDown={onKeyDown}
              className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-muted"
            />
          </div>
          <ul
            id={ids.list}
            role="listbox"
            aria-label="Località trovate"
            hidden={options.length === 0}
            className="mt-2 overflow-hidden rounded-2xl border border-white/15 bg-popover/90 shadow-2xl backdrop-blur-xl"
          >
            {options.map((p, i) => (
              <li
                key={`${p.name}-${p.lat}-${p.lon}`}
                id={`${ids.list}-${i}`}
                role="option"
                aria-selected={i === active}
                // mouse down, not click: the field loses focus on mouse down and would close the list first
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(p);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-4 py-2.5 text-ink ${i === active ? "bg-white/10" : ""}`}
              >
                <span className="text-body">{p.name}</span>
                <span className="block text-caption text-ink-muted">{placeSubtitle(p)}</span>
              </li>
            ))}
          </ul>
          <p role="status" className="sr-only">
            {status}
          </p>
          {mine?.status === "done" && options.length === 0 ? <p className="mt-2 px-4 text-caption text-ink">{status}</p> : null}
        </div>
      )}
    </div>
  );
}
