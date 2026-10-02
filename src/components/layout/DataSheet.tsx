"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** How far the sheet of weather data is up on a phone: put away, halfway (the map still above it), or nearly the whole screen. */
export type SheetState = "closed" | "half" | "full";

const SheetContext = createContext<{
  state: SheetState;
  setState: (state: SheetState) => void;
} | null>(null);

/** The sheet's state, shared by the sheet, the bar that opens it and what inside it moves it (a day picked in the week). */
export function DataSheetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SheetState>("closed");
  const value = useMemo(() => ({ state, setState }), [state]);
  return (
    <SheetContext.Provider value={value}>{children}</SheetContext.Provider>
  );
}

export function useDataSheet() {
  const sheet = useContext(SheetContext);
  if (!sheet) throw new Error("useDataSheet outside DataSheetProvider");
  return sheet;
}

/**
 * One action of the phone's bar: a word over a rule of its own colour, faint when idle and full (with the
 * word in the accent) when what it opens is open. Shared by the bar's three: the data, the poster, the map.
 */
export const BAR_ITEM =
  "flex w-full flex-col gap-1.5 py-1 font-display text-[0.9375rem] font-medium leading-none tracking-[-0.01em] text-ink transition-colors after:h-0.5 after:w-full after:bg-current after:opacity-35 after:transition-opacity hover:text-accent aria-expanded:text-accent aria-expanded:after:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** The heights the sheet stops at, over the bar at the foot of the screen */
const HEIGHT: Record<SheetState, string> = {
  closed: "0px",
  half: "52dvh",
  full: "calc(100dvh - max(3.5rem, env(safe-area-inset-top) + 2.5rem))",
};
/** How far a drag on the handle must go to move the sheet one stop */
const DRAG = 36;

/**
 * On a phone, the weather data in a sheet of glass that rises from the foot of the screen, so the poster
 * and the map stay in view: put away until asked for, then halfway with the map above it, or dragged up
 * to nearly the whole screen, scrolling inside. It is glass with no edge drawn: the sky, half clear and
 * blurred, its corners rounded and a soft shadow under it, so it lies over the page; the city shows
 * through it. On a computer it is no box at all (display: contents) and its children keep their places
 * in the page's grid.
 */
export function DataSheet({ children }: { children: ReactNode }) {
  const { state, setState } = useDataSheet();
  const start = useRef<number | null>(null);
  // A drag that moved the sheet: the click that ends it must not move it again
  const dragged = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);

  // Escape puts the sheet away
  useEffect(() => {
    if (state === "closed") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setState("closed");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, setState]);

  // Put away, it starts again from its top
  useEffect(() => {
    if (state === "closed") scroller.current?.scrollTo({ top: 0 });
  }, [state]);

  const step = useCallback(
    (up: boolean) => {
      if (up) setState(state === "closed" ? "half" : "full");
      else setState(state === "full" ? "half" : "closed");
    },
    [state, setState],
  );

  return (
    <section
      id="data-sheet"
      aria-label="Dati meteo"
      data-state={state}
      // The height is only the phone's: on a computer this box is display: contents, and it has none
      style={{ height: HEIGHT[state] }}
      className="max-lg:fixed max-lg:inset-x-2 max-lg:bottom-0 max-lg:z-30 max-lg:flex max-lg:flex-col max-lg:overflow-hidden max-lg:rounded-t-[1.75rem] max-lg:bg-[color-mix(in_oklab,var(--sky-1)_44%,transparent)] max-lg:shadow-[0_-18px_48px_rgb(0_0_0/0.32),inset_0_1px_0_rgb(255_255_255/0.12)] max-lg:backdrop-blur-2xl max-lg:backdrop-saturate-[1.8] max-lg:transition-[height] max-lg:duration-300 max-lg:ease-out motion-reduce:transition-none max-lg:data-[state=closed]:invisible lg:contents"
    >
      {/* The handle: dragged up or down it moves the sheet a stop; tapped, it goes from halfway to high and back */}
      <button
        type="button"
        aria-label={state === "full" ? "Abbassa i dati" : "Alza i dati"}
        onPointerDown={(e) => {
          start.current = e.clientY;
          dragged.current = false;
        }}
        onPointerUp={(e) => {
          const from = start.current;
          start.current = null;
          if (from == null) return;
          const moved = e.clientY - from;
          if (Math.abs(moved) < DRAG) return;
          dragged.current = true;
          step(moved < 0);
        }}
        onPointerCancel={() => {
          start.current = null;
        }}
        // A tap, or Enter and Space: from halfway to high and back
        onClick={() => {
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          setState(state === "full" ? "half" : "full");
        }}
        className="flex h-7 w-full shrink-0 touch-none items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-accent lg:hidden"
      >
        <span
          aria-hidden="true"
          className="h-1 w-10 rounded-full bg-white/45"
        />
      </button>
      {/* Room at the foot for the bar, which the sheet runs under */}
      <div
        ref={scroller}
        className="max-lg:min-h-0 max-lg:flex-1 max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:px-5 max-lg:pb-[calc(5.75rem+env(safe-area-inset-bottom))] sm:max-lg:px-8 lg:contents"
      >
        {children}
      </div>
    </section>
  );
}
