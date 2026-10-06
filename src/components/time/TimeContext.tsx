"use client";

import type { DayLabel, DayTimeline, Frame, Timeline } from "@/lib/weather/frames";
import { frameLook, type FrameLook } from "@/lib/weather/look";
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

interface Moon {
  phase: number;
  southern: boolean;
}

interface TimelineState {
  timeline: Timeline;
  moon: Moon;
}

interface ViewState {
  view: View;
  /** The selected day, in day view */
  day: DayTimeline | null;
  /** The moments the scrubber moves through */
  frames: Frame[];
  selectDay: (key: string) => void;
  backToNow: () => void;
}

interface MomentState {
  index: number;
  frame: Frame;
  /** The frame's sky colours and sun position, worked out here rather than sent per frame */
  look: FrameLook;
  /** The frame's day, by name and date */
  dayLabel: DayLabel;
  /** Now, with nothing scrubbed */
  isLive: boolean;
  setIndex: (i: number) => void;
}

const NEXT_HOURS = 24;
/** Opening a day lands on its middle */
const DAY_OPENS_AT = 12;

const TimelineContext = createContext<TimelineState | null>(null);
const ViewContext = createContext<ViewState | null>(null);
const MomentContext = createContext<MomentState | null>(null);

export function TimeProvider({ timeline, moon, children }: { timeline: Timeline; moon: Moon; children: ReactNode }) {
  const [view, setView] = useState<View>({ kind: "now" });
  const [index, setIndex] = useState(0);

  const selectDay = useCallback(
    (key: string) => {
      const target = timeline.days.find((d) => d.key === key);
      if (!target || target.isToday) {
        setView({ kind: "now" });
        setIndex(0);
        return;
      }
      setView({ kind: "day", key });
      const midday = target.hours.findIndex((i) => timeline.frames[i].hour >= DAY_OPENS_AT);
      setIndex(Math.max(0, midday));
    },
    [timeline],
  );

  const backToNow = useCallback(() => {
    setView({ kind: "now" });
    setIndex(0);
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
  const momentState = useMemo<MomentState>(() => {
    const frame = frames[Math.min(index, frames.length - 1)];
    return {
      index,
      frame,
      look: frameLook(frame),
      dayLabel: timeline.dayLabels[frame.dayKey],
      isLive: !day && index === 0,
      setIndex,
    };
  }, [timeline, frames, day, index]);

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
        // The year of the moment on show, for Climate Crisis's YEAR axis (ADR-014), held to the face's range
        "--climate-year": String(Math.min(2050, Math.max(1979, new Date(frame.time * 1000).getUTCFullYear()))),
      }) as CSSProperties,
    [p, frame.time],
  );
  return (
    <main data-state={frame.state} data-phase={frame.phase} className={className} style={vars}>
      {children}
    </main>
  );
}
