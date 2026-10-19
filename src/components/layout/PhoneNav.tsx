"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/*
 * What is left of the phone's old way around the page (three pages and two sheets): the Create page's poster button
 * still reads it, and the glass the poster's dialog and the map's panels are made of lives here. The home page
 * has no sheets any more (ADR-028): it is one page that scrolls, with a bar at its foot.
 */

/** Where the phone is: the poster, or one of the sheets over it */
export type PhonePage = "poster" | "data" | "map";
/** How far up a sheet was: put away, halfway, or nearly the whole screen */
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

/** The glass the poster's maker and the map's panel are made of: the sky, half clear and blurred, no edge drawn, a soft shadow under it */
export const GLASS =
  "bg-[color-mix(in_oklab,var(--sky-1)_44%,transparent)] shadow-[0_-18px_48px_rgb(0_0_0/0.32),inset_0_1px_0_rgb(255_255_255/0.12)] backdrop-blur-2xl backdrop-saturate-[1.8]";

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
