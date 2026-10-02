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

/*
 * The phone's way around the page: three pages, the poster (the page itself, the map behind it), the
 * weather data and the map's colours and layers. The data and the map are sheets of glass that rise from
 * the foot of the screen, one at a time; a small bar of icons floats over the poster to open them, and
 * goes away while one is open. On a computer none of this shows: the data are a column, the map's
 * controls a panel.
 */

/** Where the phone is: the poster, or one of the sheets over it */
export type PhonePage = "poster" | "data" | "map";
/** How far up a sheet is: put away, halfway (the poster still above it), or nearly the whole screen */
export type SheetState = "closed" | "half" | "full";

const NavContext = createContext<{
  page: PhonePage;
  stop: Exclude<SheetState, "closed">;
  go: (page: PhonePage, stop?: Exclude<SheetState, "closed">) => void;
} | null>(null);

export function PhoneNavProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<PhonePage>("poster");
  const [stop, setStop] = useState<Exclude<SheetState, "closed">>("half");
  const value = useMemo(
    () => ({
      page,
      stop,
      go: (next: PhonePage, at: Exclude<SheetState, "closed"> = "half") => {
        setPage(next);
        setStop(at);
      },
    }),
    [page, stop],
  );
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function usePhoneNav() {
  const nav = useContext(NavContext);
  if (!nav) throw new Error("usePhoneNav outside PhoneNavProvider");
  return nav;
}

/** One sheet's state, and the way to move it: put away, it is the poster again */
export function useSheet(name: Exclude<PhonePage, "poster">) {
  const { page, stop, go } = usePhoneNav();
  const state: SheetState = page === name ? stop : "closed";
  const setState = (next: SheetState) =>
    next === "closed" ? go("poster") : go(name, next);
  return { state, setState };
}

/** The glass every sheet (and the poster's maker) is made of: the sky, half clear and blurred, no edge drawn, a soft shadow under it (Sheet writes the same out with max-lg: in front, for Tailwind to see) */
export const GLASS =
  "bg-[color-mix(in_oklab,var(--sky-1)_44%,transparent)] shadow-[0_-18px_48px_rgb(0_0_0/0.32),inset_0_1px_0_rgb(255_255_255/0.12)] backdrop-blur-2xl backdrop-saturate-[1.8]";

/** The heights the sheet stops at */
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
 * A sheet of glass on a phone, rising from the foot of the screen. It follows the finger: dragged up it
 * rises with it, dragged down it comes down, and let go it settles on the nearest stop (or the next one,
 * if flung). Halfway the whole sheet can be dragged; at the top its content scrolls, and the handle,
 * "Chiudi" or Esc bring it down. A sideways drag is left alone, for the timeline inside the data. Its head
 * names it and closes it; `actions` go beside "Chiudi". With `desktop="contents"` it is no box at all on
 * a computer (display: contents), its children keeping their places in the page's grid; otherwise it is
 * a phone's alone.
 */
export function Sheet({
  name,
  title,
  actions,
  desktop = "hidden",
  children,
}: {
  name: Exclude<PhonePage, "poster">;
  title: string;
  actions?: ReactNode;
  desktop?: "contents" | "hidden";
  children: ReactNode;
}) {
  const { state, setState } = useSheet(name);
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
  });

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
    // Buttons and controls in the head stay buttons
    if (
      !onHandle &&
      (e.target as HTMLElement).closest("button, a, input, select, label")
    )
      return;
    // At the top the content scrolls under the finger: only the handle and the head move the sheet then
    if (
      state === "full" &&
      !onHandle &&
      !(e.target as HTMLElement).closest("[data-sheet-head]")
    )
      return;
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
      // Sideways is the timeline's, or a slider's
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
      id={`sheet-${name}`}
      aria-label={title}
      data-state={state}
      data-dragging={drag != null ? "" : undefined}
      // The height is only the phone's: on a computer this box is display: contents, or not shown
      style={{ height: drag != null ? `${drag}px` : HEIGHT[state] }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      className={`max-lg:fixed max-lg:inset-x-2 max-lg:bottom-0 max-lg:z-40 max-lg:flex max-lg:flex-col max-lg:overflow-hidden max-lg:rounded-t-[1.75rem] max-lg:bg-[color-mix(in_oklab,var(--sky-1)_44%,transparent)] max-lg:shadow-[0_-18px_48px_rgb(0_0_0/0.32),inset_0_1px_0_rgb(255_255_255/0.12)] max-lg:backdrop-blur-2xl max-lg:backdrop-saturate-[1.8] max-lg:transition-[height] max-lg:duration-300 max-lg:ease-out motion-reduce:transition-none max-lg:data-[dragging]:transition-none max-lg:data-[state=closed]:invisible ${
        desktop === "contents" ? "lg:contents" : "lg:hidden"
      } ${state === "half" ? "max-lg:touch-pan-x" : ""}`}
    >
      {/* The handle: dragged, the sheet follows it; tapped, it goes from halfway to high and back */}
      <button
        type="button"
        data-sheet-handle
        aria-label={
          state === "full"
            ? `Abbassa ${title.toLowerCase()}`
            : `Alza ${title.toLowerCase()}`
        }
        onClick={() => {
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          setState(state === "full" ? "half" : "full");
        }}
        className="flex h-7 w-full shrink-0 touch-none items-end justify-center focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-accent lg:hidden"
      >
        <span
          aria-hidden="true"
          className="mb-1 h-1 w-10 rounded-full bg-white/45"
        />
      </button>
      {/* The head: what the sheet is, what may be done here, and the way out */}
      <div
        data-sheet-head
        className="flex shrink-0 touch-none items-baseline justify-between gap-4 px-5 pb-2 pt-1 sm:px-8 lg:hidden"
      >
        <h2 className="font-display text-xl font-bold leading-none tracking-[-0.03em]">
          {title}
        </h2>
        <div className="flex items-baseline gap-5 text-sm">
          {actions}
          <button
            type="button"
            onClick={() => setState("closed")}
            className="text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            Chiudi
          </button>
        </div>
      </div>
      {/* Halfway the content stays still under the finger (the sheet moves); at the top it scrolls */}
      <div
        ref={scroller}
        className={`max-lg:min-h-0 max-lg:flex-1 max-lg:overscroll-contain max-lg:px-5 max-lg:pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:max-lg:px-8 ${
          desktop === "contents" ? "lg:contents" : ""
        } ${state === "full" ? "max-lg:overflow-y-auto" : "max-lg:overflow-hidden"}`}
      >
        {children}
      </div>
    </section>
  );
}

/** The three pages of the bar, in its order */
const PAGES: PhonePage[] = ["data", "map", "poster"];

/**
 * The bar's lens, a drop of glass on the page you are on: when the page changes it travels to the new
 * icon, stretching as it goes and settling with a little bounce. Those who asked for less motion see it
 * move without the stretch.
 */
export function useLens(
  page: PhonePage,
  tabs: React.RefObject<(HTMLElement | null)[]>,
) {
  const lens = useRef<HTMLSpanElement>(null);
  const at = useRef<number>(PAGES.indexOf(page));
  useEffect(() => {
    const el = lens.current;
    const list = tabs.current;
    const to = PAGES.indexOf(page);
    const target = list?.[to];
    if (!el || !target) return;
    const x = (i: number) => list[i]?.offsetLeft ?? 0;
    const from = at.current;
    at.current = to;
    el.style.width = `${target.offsetWidth}px`;
    el.style.transform = `translateX(${x(to)}px)`;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (from === to || still) return;
    const dir = Math.sign(x(to) - x(from));
    el.animate(
      [
        { transform: `translateX(${x(from)}px) scale(1, 1)` },
        {
          transform: `translateX(${x(from) + (x(to) - x(from)) * 0.45}px) scale(${1 + 0.2 * Math.abs(to - from)}, 0.86)`,
          offset: 0.45,
        },
        {
          transform: `translateX(${x(to) + dir * 3}px) scale(0.96, 1.05)`,
          offset: 0.78,
        },
        { transform: `translateX(${x(to)}px) scale(1, 1)` },
      ],
      { duration: 480, easing: "cubic-bezier(0.3, 0.7, 0.2, 1)" },
    );
  }, [page, tabs]);
  return lens;
}

/** One page of the bar: its icon over its name, in the colour of the temperature on show (--selected, set by the bar) when it is the page on show */
export function BarTab({
  label,
  hint,
  current,
  onClick,
  tabRef,
  children,
}: {
  label: string;
  /** What a tap does here, when it isn't going to the page (the poster's makes one) */
  hint?: string;
  current: boolean;
  onClick: () => void;
  tabRef: (el: HTMLButtonElement | null) => void;
  children: ReactNode;
}) {
  return (
    <button
      ref={tabRef}
      type="button"
      aria-label={hint ?? label}
      aria-current={current ? "page" : undefined}
      onClick={onClick}
      className="relative z-1 flex h-[3.25rem] w-full flex-col items-center justify-center gap-1 rounded-full text-ink transition-colors duration-300 aria-[current=page]:text-(--selected) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
      <span
        aria-hidden="true"
        className="whitespace-nowrap text-[0.75rem] font-medium leading-none tracking-[0.005em]"
      >
        {label}
      </span>
    </button>
  );
}

/** The bar's icons: solid shapes, as the system's tab bars draw them, on a 24 grid */
export const ICONS = {
  // A sun half behind a cloud: the weather
  data: (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-[1.375rem]"
      fill="currentColor"
    >
      <circle cx="9" cy="8.5" r="3.6" />
      <path d="M9 1.6a.8.8 0 0 1 .8.8v.9a.8.8 0 0 1-1.6 0v-.9a.8.8 0 0 1 .8-.8ZM3.4 3.9a.8.8 0 0 1 1.1 0l.65.65a.8.8 0 1 1-1.13 1.13L3.4 5a.8.8 0 0 1 0-1.1ZM1.6 8.5a.8.8 0 0 1 .8-.8h.9a.8.8 0 0 1 0 1.6h-.9a.8.8 0 0 1-.8-.8ZM14.6 3.9a.8.8 0 0 1 0 1.1l-.65.65a.8.8 0 1 1-1.13-1.13l.65-.65a.8.8 0 0 1 1.13 0Z" />
      <path
        d="M15.2 9.2a5.3 5.3 0 0 1 5.05 3.72A4.1 4.1 0 0 1 19.4 21H8.6a3.9 3.9 0 0 1-.9-7.7 5.3 5.3 0 0 1 7.5-4.1Z"
        stroke="var(--bar-cut, transparent)"
        strokeWidth="1.6"
        paintOrder="stroke"
      />
    </svg>
  ),
  // A folded map, three panels with a pin: the map to change
  map: (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-[1.375rem]"
      fill="currentColor"
    >
      <path
        d="M2.5 6.1a1 1 0 0 1 .62-.92l4.6-1.9a1 1 0 0 1 .7-.02L8.5 3.3v17.4l-5.38 2.2a.45.45 0 0 1-.62-.42V6.1Z"
        opacity="0.75"
      />
      <path d="M9.8 3.3l4.4 1.6v16.4l-4.4-1.6V3.3Z" />
      <path
        d="M15.5 4.9l5.38-2.2a.45.45 0 0 1 .62.42v15.8a1 1 0 0 1-.62.92l-4.6 1.9a1 1 0 0 1-.78.02V4.9Z"
        opacity="0.75"
      />
    </svg>
  ),
  // A sheet with the city's skyline and its name: the poster
  poster: (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-[1.375rem]"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M6.5 2h11A2.5 2.5 0 0 1 20 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Zm.5 2.5a.5.5 0 0 0-.5.5v8.2h1.6v-3h1.6v-2.6h1.8v3.4h1.4V8.2h1.8v5h1.6v-2h1.2V5a.5.5 0 0 0-.5-.5H7ZM7.5 16a.75.75 0 0 0 0 1.5h6a.75.75 0 0 0 0-1.5h-6Zm0 2.6a.6.6 0 0 0 0 1.2h3.5a.6.6 0 0 0 0-1.2H7.5Z"
      />
    </svg>
  ),
};
