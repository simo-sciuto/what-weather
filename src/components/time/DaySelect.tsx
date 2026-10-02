"use client";

import type { ReactNode } from "react";
import { useDataSheet } from "../layout/DataSheet";
import { useView } from "./TimeContext";

/**
 * Makes a row of the week card open that day on the left (sky, reading,
 * hours). On a phone the week is in the sheet of data: it comes down to halfway,
 * so the reading of the day picked shows above it.
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
  const sheet = useDataSheet();
  // Today's row stands for the "now" view.
  const selected = view.kind === "day" ? view.key === dayKey : isToday;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => {
        selectDay(dayKey);
        if (window.matchMedia("(width < 64rem)").matches)
          sheet.setState("half");
      }}
      className={`w-full rounded-lg text-left transition-colors hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-accent ${
        selected ? "bg-white/12 shadow-[inset_2px_0_0_var(--accent)]" : ""
      } ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
