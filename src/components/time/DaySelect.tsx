"use client";

import type { ReactNode } from "react";
import { useView } from "./TimeContext";

/**
 * Makes a row of the week card open that day on the left (sky, reading,
 * hours). On a phone the reading sits above the week, so we scroll back to it.
 */
export function DaySelect({
  dayKey,
  isToday,
  className,
  children,
}: {
  dayKey: string;
  isToday: boolean;
  className?: string;
  children: ReactNode;
}) {
  // The view only: scrubbing through the hours doesn't re-render the week.
  const { view, selectDay } = useView();
  // Today's row stands for the "now" view.
  const selected = view.kind === "day" ? view.key === dayKey : isToday;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => {
        selectDay(dayKey);
        if (window.matchMedia("(width < 64rem)").matches) window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className={`w-full rounded-2xl text-left transition-colors hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-accent ${
        selected ? "bg-white/15 ring-1 ring-white/25" : ""
      } ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
