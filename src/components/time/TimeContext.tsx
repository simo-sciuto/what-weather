"use client";

import type { TimeSelection } from "@/types/time";
import type { DayLabel, DayTimeline, Frame, Timeline } from "@/types/timeline";
import { trackOnce } from "@/lib/analytics/analytics";
import { frameLook, type FrameLook } from "@/lib/weather/look";
import type { MomentStart } from "@/lib/weather/moment";
import {
  NOW_SELECTION,
  indexForSelection,
  sameSelection,
  selectionForDay,
  selectionForIndex,
} from "@/lib/weather/moment-selection";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/**
 * What the page is showing, as three contexts that change at different paces,
 * so each component re-renders only when what it reads changes:
 *
 *  - Timeline: the place's forecast (frames, days, sun, moon). Fixed for a place.
 *  - View: the span on show, the next 24 hours or one day of the week, and
 *    the actions that change it. Changes when a day is picked.
 *  - Moment: the hour on show within that span. Changes on every scrub.
 *
 * The week's rows, for instance, read only the view: dragging the timeline
 * leaves them alone.
 */

type View = { kind: "now" } | { kind: "day"; key: string };

type Moon = {
  phase: number;
  southern: boolean;
};

type TimelineState = {
  timeline: Timeline;
  moon: Moon;
};

type ViewState = {
  view: View;
  /** The selected day, in day view */
  day: DayTimeline | null;
  /** The moments the scrubber moves through */
  frames: Frame[];
  selectDay: (key: string) => void;
  backToNow: () => void;
};

type MomentState = {
  index: number;
  frame: Frame;
  /** The frame's sky colours and sun position, worked out here rather than sent per frame */
  look: FrameLook;
  /** The frame's day, by name and date */
  dayLabel: DayLabel;
  /** Now, with nothing scrubbed */
  isLive: boolean;
  /** What the moment is: "Adesso", or an absolute instant (ADR-019). `index` and `frame` are what it shows here. */
  selection: TimeSelection;
  setIndex: (i: number) => void;
};

const NEXT_HOURS = 24;

const TimelineContext = createContext<TimelineState | null>(null);
const ViewContext = createContext<ViewState | null>(null);
const MomentContext = createContext<MomentState | null>(null);

/** The selection a page opens on: "Adesso", or the moment Create was opened on (its day, if it is not today, and the hour in that day) */
function startSelection(timeline: Timeline, start?: MomentStart | null): TimeSelection {
  if (!start) return NOW_SELECTION;
  const day = start.day ? timeline.days.find((d) => d.key === start.day) : undefined;
  const frames = day ? (day.hours.length ? day.hours.map((i) => timeline.frames[i]) : [day.overview]) : timeline.frames.slice(0, NEXT_HOURS + 1);
  return selectionForIndex(frames, start.index, day !== undefined);
}

/**
 * The moment is held as a selection, "Adesso" or an absolute instant, and the indices the page's components speak
 * in (`index`, `setIndex`) are worked out from it against the frames on show, so every component keeps the contract
 * it always had. "Adesso" is the page's live reading, which the refresh keeps current.
 *
 * `start`: the moment the page opens on, when it is not the current one (Create, WTH-236). Absent, the page opens on
 * the current conditions, as Explore always has.
 */
export function TimeProvider({ timeline, moon, start, children }: { timeline: Timeline; moon: Moon; start?: MomentStart | null; children: ReactNode }) {
  const [view, setView] = useState<View>(() => (start?.day ? { kind: "day", key: start.day } : { kind: "now" }));
  const [selection, setSelection] = useState<TimeSelection>(() => startSelection(timeline, start));

  const selectDay = useCallback(
    (key: string) => {
      trackOnce("explore", { source: "day" });
      const target = timeline.days.find((d) => d.key === key);
      if (!target || target.isToday) {
        setView({ kind: "now" });
        setSelection(NOW_SELECTION);
        return;
      }
      setView({ kind: "day", key });
      setSelection(selectionForDay(timeline, target));
    },
    [timeline],
  );

  const backToNow = useCallback(() => {
    setView({ kind: "now" });
    setSelection(NOW_SELECTION);
  }, []);

  const timelineState = useMemo<TimelineState>(() => ({ timeline, moon }), [timeline, moon]);

  const viewState = useMemo<ViewState>(() => {
    const day = view.kind === "day" ? (timeline.days.find((d) => d.key === view.key) ?? null) : null;
    const frames = day
      ? day.hours.length
        ? day.hours.map((i) => timeline.frames[i])
        : [day.overview]
      : timeline.frames.slice(0, NEXT_HOURS + 1);
    return { view, day, frames, selectDay, backToNow };
  }, [timeline, view, selectDay, backToNow]);

  const { frames, day } = viewState;
  // Bound to the frames on show in this render, as the selection needs them (the old setter stored a bare number):
  // call it after a view change has rendered, not in the same handler as `selectDay` or `backToNow`.
  const setIndex = useCallback(
    (i: number) => {
      trackOnce("explore", { source: "scrub" });
      const next = selectionForIndex(frames, i, day !== null);
      setSelection((prev) => (sameSelection(prev, next) ? prev : next));
    },
    [frames, day],
  );

  const momentState = useMemo<MomentState>(() => {
    const index = indexForSelection(frames, selection);
    const frame = frames[index];
    return {
      index,
      frame,
      look: frameLook(frame),
      dayLabel: timeline.dayLabels[frame.dayKey],
      isLive: !day && selection.mode === "now",
      selection,
      setIndex,
    };
  }, [timeline, frames, day, selection, setIndex]);

  return (
    <TimelineContext.Provider value={timelineState}>
      <ViewContext.Provider value={viewState}>
        <MomentContext.Provider value={momentState}>{children}</MomentContext.Provider>
      </ViewContext.Provider>
    </TimelineContext.Provider>
  );
}

function required<T>(value: T | null, hook: string): T {
  if (!value) throw new Error(`${hook} must be used inside <TimeProvider>`);
  return value;
}

/** The place's forecast: frames, days, sun and moon. Never changes for a place. */
export function useTimeline(): TimelineState {
  return required(useContext(TimelineContext), "useTimeline");
}

/** The span on show and how to change it. Changes when a day is picked. */
export function useView(): ViewState {
  return required(useContext(ViewContext), "useView");
}

/** The hour on show. Changes on every scrub: read it only where it is drawn. */
export function useMoment(): MomentState {
  return required(useContext(MomentContext), "useMoment");
}

/**
 * The page root. It carries the palette of the moment on show as CSS custom
 * properties; the sky, the glass and the markers all read from them, and the
 * registered sky colours cross-fade as the moment changes. The browser's own
 * chrome (theme-color) follows the top of the sky too, scrubbing included:
 * set here rather than in generateViewport, which would hold back the whole
 * prerendered shell until the weather is known.
 */
export function AtmosphereMain({ className, children }: { className?: string; children: ReactNode }) {
  const { frame, look } = useMoment();
  const p = look.palette;

  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.append(meta);
    }
    meta.content = p.sky1;
  }, [p.sky1]);

  const vars = useMemo(
    () =>
      ({
        "--sky-1": p.sky1,
        "--sky-2": p.sky2,
        "--sky-3": p.sky3,
        "--glass": p.glass,
        "--glow": p.glow,
        "--sun": p.sun,
        "--cloud": p.cloud,
      }) as CSSProperties,
    [p],
  );
  return (
    <main data-state={frame.state} data-phase={frame.phase} className={className} style={vars}>
      {children}
    </main>
  );
}
