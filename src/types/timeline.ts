import type { AtmosphericMeasurements, Condition, Intensity } from "@/types/weather";
import type { DayPhase, SunEvent, WeatherState } from "@/types/sky";
/**
 * One moment on the timeline, as sent to the browser. It carries only what
 * the browser can't work out itself: the palette, the sun's position and the
 * condition's label are derived from these fields there (see look.ts and
 * conditionLabel), and the day's name and date live once per day in
 * `Timeline.dayLabels`. There are over a hundred frames, so every field
 * counts.
 */
export type Frame = {
  /** Synthetic daily representative, not an hourly measurement. */
  overview?: true;
  time: number;
  isNow: boolean;
  /** A reading or forecast point as the provider gave it, not an hour interpolated between two */
  measured: boolean;
  /** "Adesso", "18:00" */
  timeLabel: string;
  /** Local hour of day, 0–23 */
  hour: number;
  /** Local calendar day, "YYYY-MM-DD"; its name and date are in `Timeline.dayLabels` */
  dayKey: string;
  temp: number;
  feelsLike: number;
  condition: Condition;
  intensity: Intensity;
  state: WeatherState;
  phase: DayPhase;
  /** Daylight on a continuous scale; see `lightAt` */
  light: number;
  /** 0..100 */
  cloudCover: number;
  /** mm/h */
  precipitation: number;
  precipProbability: number;
  /** km/h */
  windSpeed: number;
  /** The UV index, which also sets how vivid the sky is; absent when the provider has no UV data */
  uv?: number;
  /** A sentence for this moment, used when scrubbed away from now */
  summary: string;
} & AtmosphericMeasurements;

export type Timeline = {
  frames: Frame[];
  days: DayTimeline[];
  /** The best hours to be outside in the next 24; null when there are none */
  best: BestWindow | null;
  /** By `Frame.dayKey` */
  dayLabels: Record<string, DayLabel>;
  /** Sunrises, sunsets and nights across all the frames, for the timeline's shading */
  sun: { events: (SunEvent & { label: string })[]; nights: [number, number][] };
};

/** A day on the week timeline: its hours, or — beyond hourly data — one summary frame. */
export type DayTimeline = {
  key: string;
  name: string;
  dateLabel: string;
  isToday: boolean;
  high: number;
  low: number;
  /** True when high and low cover only part of the day (`DailyPoint.partial`) */
  partial?: boolean;
  /** A sentence for the whole day */
  summary: string;
  /** The best hours of the day to be outside; null when there are none (or no hours to tell) */
  best: BestWindow | null;
  /** Indices into `frames` of this day's hours; empty when the forecast has none */
  hours: number[];
  /** Stand-in when there are no hours: the day's overall sky at midday */
  overview: Frame;
};

/** A calendar day's name and date, shared by all its frames. */
export type DayLabel = {
  /** "Mercoledì" */
  weekday: string;
  /** "30 settembre" */
  date: string;
  /** "Oggi" / "Domani" when it applies */
  relative: string | null;
};

export type BestWindow = {
  from: number;
  to: number;
  /** "dalle 14 alle 18", "adesso, fino alle 18", "domani dalle 10 alle 16" */
  label: string;
};
