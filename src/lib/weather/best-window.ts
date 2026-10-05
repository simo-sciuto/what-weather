import { clamp01 } from "@/utils/math";
import { THRESHOLDS, isWet } from "./constants";
import { localDay, spokenTime } from "./formatters";
import type { Condition } from "@/types/weather";

/**
 * The best stretch of hours to be outside: each hour gets a score from how it
 * feels, how likely rain is, the wind and the UV, and the window is the run of
 * hours that score about as well as the best one. A profile says what the
 * hours are scored for. Pure functions of the
 * timeline's hourly samples; the timeline carries the result (see frames.ts).
 *
 * Air quality stays out of it: there is one reading, for now, so it can't tell
 * one hour from another (the outlook already speaks for it).
 */

export type OutdoorHour = {
  time: number;
  feelsLike: number;
  condition: Condition;
  precipProbability: number;
  windSpeed: number;
  night: boolean;
  /** Absent when the provider has no UV data */
  uvIndex?: number;
};

/** What an hour is scored for: being outside in general, or one activity (see activities.ts). */
export type OutdoorProfile = {
  /** The feels-like (°C) that scores highest */
  ideal: number;
  /** How many degrees below and above it an hour loses everything */
  coldSpan: number;
  hotSpan: number;
  /** The least a temperature alone can score */
  comfortFloor: number;
  /** How much a chance of rain weighs (1 = as it is) */
  rain: number;
  /** The wind (km/h) that starts to cost, over how many more it costs the most, and how much that is */
  wind: { from: number; span: number; cost: number };
  /** How much a very high UV costs */
  uv: number;
};

/**
 * Being outside, whatever for. Cold and heat are relative to the place
 * (Reykjavík in January still has a best hour), so temperature alone never
 * rules an hour out here: it only ranks them.
 */
export const GENERAL: OutdoorProfile = {
  ideal: 22,
  coldSpan: 18,
  hotSpan: 12,
  comfortFloor: 0.4,
  rain: 1,
  wind: { from: 20, span: 40, cost: 0.7 },
  uv: 0.4,
};
/** Below this, no hour is worth recommending (it takes rain or wind to get here). */
const FLOOR = 0.35;
/** Hours within this much of the best one belong to the window. */
const TOLERANCE = 0.1;


/** What an hour's score is made of, each 0..1; the score is their product. */
export type OutdoorFactors = {
  /** 0 after dark */
  light: number;
  /** How the temperature feels */
  comfort: number;
  /** 0 in a storm or in likely rain */
  dry: number;
  /** A wet sky that may well stay dry, or fog: possible, not pleasant */
  sky: number;
  wind: number;
  uv: number;
};

export function outdoorFactors(h: OutdoorHour, p: OutdoorProfile = GENERAL): OutdoorFactors {
  const wet = isWet(h.condition);
  const rained = h.condition === "thunderstorm" || (wet && h.precipProbability >= THRESHOLDS.precipProbability);
  const off = h.feelsLike < p.ideal ? (p.ideal - h.feelsLike) / p.coldSpan : (h.feelsLike - p.ideal) / p.hotSpan;
  return {
    light: h.night ? 0 : 1,
    comfort: Math.max(p.comfortFloor, 1 - off * off),
    // Eased, so a small chance costs next to nothing and an even one costs a third.
    dry: rained ? 0 : 1 - clamp01(h.precipProbability * p.rain) ** 1.5,
    sky: wet || h.condition === "fog" ? 0.7 : 1,
    wind: 1 - p.wind.cost * clamp01((h.windSpeed - p.wind.from) / p.wind.span),
    uv: 1 - p.uv * clamp01(((h.uvIndex ?? 0) - THRESHOLDS.highUv) / 5),
  };
}

/** How good an hour is for being outside, 0..1. Dark, stormy and rainy hours score nothing. */
export function outdoorScore(h: OutdoorHour, p: OutdoorProfile = GENERAL): number {
  const f = outdoorFactors(h, p);
  return f.light * f.comfort * f.dry * f.sky * f.wind * f.uv;
}

/**
 * The window among these hours (evenly spaced, in order), or null when none is
 * worth going out for. Of the runs that score about as well as the best hour,
 * the earliest lasting more than one hour wins: what is good soon beats what
 * is a little better tomorrow.
 */
export function bestWindow(hours: OutdoorHour[], profile: OutdoorProfile = GENERAL): { from: number; to: number } | null {
  const scores = hours.map((h) => outdoorScore(h, profile));
  const best = Math.max(0, ...scores);
  if (best < FLOOR) return null;
  const threshold = Math.max(FLOOR, best - TOLERANCE);

  const runs: [number, number][] = [];
  scores.forEach((s, i) => {
    if (s < threshold) return;
    const last = runs.at(-1);
    if (last && last[1] === i - 1) last[1] = i;
    else runs.push([i, i]);
  });

  const peak = scores.indexOf(best);
  const [a, b] = runs.find(([x, y]) => y > x) ?? runs.find(([x, y]) => x <= peak && peak <= y)!;
  return { from: hours[a].time, to: hours[b].time };
}

/**
 * The window in words, as they follow "Momento migliore:". With `now` (the
 * next-24-hours view) a window that starts now says so, and one that starts
 * after midnight says "domani"; a day's own window gives just its hours.
 */
export function windowLabel(w: { from: number; to: number }, timezone: string, now?: number): string {
  if (w.from === now) return w.to === w.from ? "adesso" : `adesso, ${spokenTime(w.to, timezone, "fino alle")}`;
  const tomorrow = now != null && localDay(w.from, timezone) !== localDay(now, timezone) ? "domani " : "";
  if (w.to === w.from) return `${tomorrow}${spokenTime(w.from, timezone, "verso le")}`;
  return `${tomorrow}${spokenTime(w.from, timezone, "dalle")} ${spokenTime(w.to, timezone, "alle")}`;
}
