"use client";

import { placeHref, samePlace, type PlaceRef } from "@/lib/place";
import { rememberPlace, removeSaved } from "@/lib/saved-places";
import { placeSubtitle } from "@/lib/weather/formatters";
import type { Place } from "@/lib/weather/types";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { usePlace } from "./PlaceContext";

/** The search field's id, for its label. */
const LOCATION_SEARCH_ID = "location-search";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; places: Place[] }
  | { status: "error" };

type LocateState = { status: "idle" } | { status: "locating" } | { status: "error"; message: string };

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </svg>
  );
}

function LocateIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </svg>
  );
}

/**
 * Search results often repeat a place: by name (several "Milano, Lombardia")
 * or by point (the same coordinates under two names, "Old Toronto" and
 * "Toronto"). One per point, under its shortest name; then one per name.
 */
function dedupe(places: Place[]): Place[] {
  const byPoint = new Map<string, Place>();
  for (const p of places) {
    const key = `${p.lat},${p.lon}`;
    const kept = byPoint.get(key);
    if (!kept || p.name.length < kept.name.length) byPoint.set(key, p);
  }
  const seen = new Set<string>();
  return [...byPoint.values()].filter((p) => {
    const key = `${p.name}|${p.region ?? ""}|${p.country}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * A search field with suggestions (ARIA combobox). Empty and focused, it
 * offers "Use my location" and saved places. Choosing a place navigates
 * client-side, so the page updates without a full reload.
 */
export function LocationSearch() {
  const router = useRouter();
  // The field's ref lives in the place context, so the place name can focus it.
  const { place, searchRef: inputRef, saved, isSaved, toggleSaved } = usePlace();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [results, setResults] = useState<SearchState>({ status: "idle" });
  const [locate, setLocate] = useState<LocateState>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const ids = { list: useId(), status: useId() };


  const searching = query.trim().length >= 2;
  const search: SearchState = searching ? results : { status: "idle" };
  const options = search.status === "done" ? search.places : [];

  // Debounced search; each keystroke cancels the previous request.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setResults({ status: "loading" });
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { places: Place[] };
        setResults({ status: "done", places: dedupe(body.places) });
        setActive(-1);
      } catch {
        if (!controller.signal.aborted) setResults({ status: "error" });
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function go(ref: PlaceRef) {
    rememberPlace(ref);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    startTransition(() => router.push(placeHref(ref)));
  }

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setLocate({ status: "error", message: "La posizione non è disponibile in questo browser. Cerca una località." });
      inputRef.current?.focus();
      return;
    }
    setLocate({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocate({ status: "idle" });
        go({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      (err) => {
        setLocate({
          status: "error",
          message:
            err.code === err.PERMISSION_DENIED
              ? "Accesso alla posizione negato. Cerca una località."
              : "Impossibile determinare la tua posizione. Cerca una località.",
        });
        inputRef.current?.focus();
      },
      { timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && options.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp" && options.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === "Enter" && options.length) {
      e.preventDefault();
      go(options[Math.max(active, 0)]);
    } else if (e.key === "Escape") {
      if (query) setQuery("");
      else {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
  }

  const status =
    search.status === "loading"
      ? "Ricerca in corso…"
      : search.status === "error"
        ? "La ricerca non è disponibile. Riprova tra poco."
        : search.status === "done" && options.length === 0
          ? "Località non trovata. Prova con un altro nome."
          : search.status === "done"
            ? `${options.length} ${options.length === 1 ? "località trovata" : "località trovate"}`
            : "";

  const optionId = (i: number) => `${ids.list}-${i}`;

  return (
    <div
      className="relative"
      // Close when focus leaves the whole control (not when moving inside it).
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      {/* A hairline progress bar while the new place loads */}
      {pending && (
        <div role="progressbar" aria-label="Caricamento del meteo" className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden">
          <div className="h-full w-1/3 animate-[loading_1.1s_ease-in-out_infinite] bg-accent" />
        </div>
      )}

      <div className="glass flex h-12 items-center gap-3 rounded-full px-4 transition-colors focus-within:border-white/40">
        <SearchIcon className="size-4.5 shrink-0 text-ink-muted" />
        <label htmlFor={LOCATION_SEARCH_ID} className="sr-only">
          Cerca località
        </label>
        <input
          ref={inputRef}
          id={LOCATION_SEARCH_ID}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={open && searching ? ids.list : undefined}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          aria-describedby={ids.status}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setLocate({ status: "idle" });
          }}
          onKeyDown={onKeyDown}
          placeholder="Cerca una città"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:appearance-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="-mr-1 shrink-0 rounded-full px-2 py-1 text-sm text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            Cancella
          </button>
        )}
      </div>

      <p id={ids.status} role="status" className="sr-only">
        {status}
      </p>

      {open && (
        <div
          // Keep focus in the input when clicking inside the panel (Safari doesn't focus buttons on click).
          onMouseDown={(e) => {
            if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
          }}
          className="absolute inset-x-0 top-full z-40 mt-2 max-h-[min(28rem,70dvh)] overflow-y-auto rounded-2xl border border-white/15 bg-popover/90 p-1.5 shadow-2xl backdrop-blur-2xl"
        >
          {searching ? (
            <>
              {search.status !== "done" || options.length === 0 ? (
                <p className="px-3 py-3 text-sm text-ink-muted">{status}</p>
              ) : null}
              <ul id={ids.list} role="listbox" aria-label="Località">
                {options.map((p, i) => (
                  <li
                    key={`${p.lat},${p.lon}`}
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === active}
                    onClick={() => go(p)}
                    onMouseEnter={() => setActive(i)}
                    className={`cursor-pointer rounded-xl px-3 py-2.5 ${i === active ? "bg-white/12" : ""}`}
                  >
                    <span className="block font-medium">{p.name}</span>
                    <span className="block text-sm text-ink-muted">{placeSubtitle(p)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={locateMe}
                disabled={locate.status === "locating"}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[0.9375rem] font-medium hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
              >
                <LocateIcon className="size-5" />
                {locate.status === "locating" ? "Ti sto localizzando…" : "Usa la mia posizione"}
              </button>
              {locate.status === "error" && (
                <p role="alert" className="px-3 pb-2 text-sm">
                  {locate.message}
                </p>
              )}

              <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-white/10 px-3 pb-1 pt-3">
                <h2 className="label">Salvate</h2>
                <button
                  type="button"
                  onClick={toggleSaved}
                  aria-pressed={isSaved}
                  className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {isSaved ? `Rimuovi ${place.name}` : `Salva ${place.name}`}
                </button>
              </div>
              {saved.length === 0 ? (
                <p className="px-3 py-2 text-sm text-ink-muted">Le località che salvi compaiono qui.</p>
              ) : (
                <ul>
                  {saved.map((p) => {
                    const current = samePlace(p, place);
                    return (
                      <li key={`${p.lat},${p.lon}`} className="flex items-center rounded-xl hover:bg-white/10">
                        <button
                          type="button"
                          onClick={() => go(p)}
                          aria-current={current ? "location" : undefined}
                          className="flex-1 px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <span className="font-medium">{p.name}</span>
                          {current && <span className="ml-2 text-xs text-ink-muted">Attuale</span>}
                          <span className="block text-sm text-ink-muted">{placeSubtitle({ ...p, country: p.country ?? "" })}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSaved(p)}
                          aria-label={`Rimuovi ${p.name}`}
                          className="mr-1 rounded-full px-3 py-2 text-lg leading-none text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          ×
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
