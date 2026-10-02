"use client";

import {
  createContext,
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
/** How far the finger must go before the sheet starts to follow it (a tap moves less), in pixels */
const DRAG_START = 6;
/** A drag let go faster than this (pixels a millisecond) goes on to the next stop in its direction */
const FLING = 0.5;
/** The sheet at the top stops this far below the screen's top, in pixels (see HEIGHT.full) */
const TOP_GAP = 56;

/** The heights of the three stops, in pixels, for the screen as it is now */
function stops() {
  const vh = window.innerHeight;
  return { closed: 0, half: vh * 0.52, full: vh - TOP_GAP };
}

/** Where a sheet let go at height `h` comes to rest: the nearest stop, or, if flung, the next one in the fling's direction */
function restingStop(h: number, velocity: number): SheetState {
  const s = stops();
  if (velocity < -FLING) return h < s.half ? "half" : "full";
  if (velocity > FLING) return h > s.half ? "half" : "closed";
  const all: SheetState[] = ["closed", "half", "full"];
  return all.reduce(
    (best, k) => (Math.abs(s[k] - h) < Math.abs(s[best] - h) ? k : best),
    "half",
  );
}

interface Gesture {
  x: number;
  y: number;
  /** The sheet's height when the finger came down */
  h: number;
  lastY: number;
  lastT: number;
  velocity: number;
  /** Following the finger: a vertical drag went past DRAG_START */
  active: boolean;
}

/**
 * On a phone, the weather data in a sheet of glass that rises from the foot of the screen, so the poster
 * and the map stay in view: put away until asked for, then halfway with the map above it, or up to nearly
 * the whole screen, scrolling inside. It follows the finger: dragged up it rises with it, dragged down it
 * comes down, and let go it settles on the nearest stop (or the next one, if flung). Halfway the whole
 * sheet can be dragged; at the top its content scrolls, and the handle (or Esc) brings it down. A
 * sideways drag is left alone, for the timeline inside it. It is glass with no edge drawn: the sky, half
 * clear and blurred, its corners rounded and a soft shadow under it, so it lies over the page; the city
 * shows through it. On a computer it is no box at all (display: contents) and its children keep their
 * places in the page's grid.
 */
export function DataSheet({ children }: { children: ReactNode }) {
  const { state, setState } = useDataSheet();
  const sheet = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  // The height the finger has the sheet at while it follows it; null when it rests on a stop
  const [drag, setDrag] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);
  // A drag that moved the sheet: the click that ends it on the handle must not move it again
  const dragged = useRef(false);

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

  const follow = (h: number | null) => {
    dragRef.current = h;
    setDrag(h);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!window.matchMedia("(width < 64rem)").matches || state === "closed")
      return;
    const onHandle = (e.target as HTMLElement).closest("[data-sheet-handle]");
    // At the top the content scrolls under the finger: only the handle moves the sheet then
    if (state === "full" && !onHandle) return;
    const h = sheet.current?.getBoundingClientRect().height ?? 0;
    dragged.current = false;
    gesture.current = {
      x: e.clientX,
      y: e.clientY,
      h,
      lastY: e.clientY,
      lastT: e.timeStamp,
      velocity: 0,
      active: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g) return;
    const dy = e.clientY - g.y;
    if (!g.active) {
      if (Math.abs(dy) < DRAG_START && Math.abs(e.clientX - g.x) < DRAG_START)
        return;
      // Sideways is the timeline's
      if (Math.abs(e.clientX - g.x) > Math.abs(dy)) {
        gesture.current = null;
        return;
      }
      g.active = true;
      sheet.current?.setPointerCapture(e.pointerId);
    }
    const dt = e.timeStamp - g.lastT;
    if (dt > 0) g.velocity = (e.clientY - g.lastY) / dt;
    g.lastY = e.clientY;
    g.lastT = e.timeStamp;
    follow(Math.min(stops().full, Math.max(0, g.h - dy)));
  };

  const onPointerEnd = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.active) return;
    dragged.current = true;
    const next = restingStop(dragRef.current ?? g.h, g.velocity);
    follow(null);
    setState(next);
  };

  return (
    <section
      ref={sheet}
      id="data-sheet"
      aria-label="Dati meteo"
      data-state={state}
      data-dragging={drag != null ? "" : undefined}
      // The height is only the phone's: on a computer this box is display: contents, and it has none
      style={{ height: drag != null ? `${drag}px` : HEIGHT[state] }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      className={`max-lg:fixed max-lg:inset-x-2 max-lg:bottom-0 max-lg:z-30 max-lg:flex max-lg:flex-col max-lg:overflow-hidden max-lg:rounded-t-[1.75rem] max-lg:bg-[color-mix(in_oklab,var(--sky-1)_44%,transparent)] max-lg:shadow-[0_-18px_48px_rgb(0_0_0/0.32),inset_0_1px_0_rgb(255_255_255/0.12)] max-lg:backdrop-blur-2xl max-lg:backdrop-saturate-[1.8] max-lg:transition-[height] max-lg:duration-300 max-lg:ease-out motion-reduce:transition-none max-lg:data-[dragging]:transition-none max-lg:data-[state=closed]:invisible lg:contents ${
        // Halfway, a vertical drag anywhere moves the sheet; sideways stays the timeline's
        state === "half" ? "max-lg:touch-pan-x" : ""
      }`}
    >
      {/* The handle: dragged, the sheet follows it; tapped, it goes from halfway to high and back */}
      <button
        type="button"
        data-sheet-handle
        aria-label={state === "full" ? "Abbassa i dati" : "Alza i dati"}
        onClick={() => {
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          setState(state === "full" ? "half" : "full");
        }}
        className="flex h-9 w-full shrink-0 touch-none items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-accent lg:hidden"
      >
        <span
          aria-hidden="true"
          className="h-1 w-10 rounded-full bg-white/45"
        />
      </button>
      {/* Halfway the content stays still under the finger (the sheet moves); at the top it scrolls. Room at the foot for the bar */}
      <div
        ref={scroller}
        className={`max-lg:min-h-0 max-lg:flex-1 max-lg:overscroll-contain max-lg:px-5 max-lg:pb-[calc(5.75rem+env(safe-area-inset-bottom))] sm:max-lg:px-8 lg:contents ${
          state === "full" ? "max-lg:overflow-y-auto" : "max-lg:overflow-hidden"
        }`}
      >
        {children}
      </div>
    </section>
  );
}
