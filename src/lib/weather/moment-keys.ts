/**
 * The keyboard of the moment's track (ADR-028, W8): arrows move one hour, PageUp and PageDown one day (the slider
 * convention: PageUp is the larger step forward), Home is "Adesso". Pure: the key in, what it asks for out.
 */

export type MomentKey = { kind: "hours"; delta: number } | { kind: "days"; delta: number } | { kind: "now" };

export function momentKey(key: string): MomentKey | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return { kind: "hours", delta: 1 };
    case "ArrowLeft":
    case "ArrowDown":
      return { kind: "hours", delta: -1 };
    case "PageUp":
      return { kind: "days", delta: 1 };
    case "PageDown":
      return { kind: "days", delta: -1 };
    case "Home":
      return { kind: "now" };
    default:
      return null;
  }
}

/**
 * The day `delta` days from the one on show, or null at the ends of the forecast. `current` is the day picked, or
 * null while the next 24 hours are on show, which belong to today.
 */
export function adjacentDay(days: { key: string; isToday: boolean }[], current: string | null, delta: number): string | null {
  const here = current === null ? days.findIndex((d) => d.isToday) : days.findIndex((d) => d.key === current);
  if (here < 0) return null;
  return days[here + delta]?.key ?? null;
}
