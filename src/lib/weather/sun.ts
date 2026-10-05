import { localDay } from "./formatters";
import type { WeatherData } from "./types";

/**
 * Near the poles there may be no sunrise or sunset today (midnight sun, polar
 * night); providers then send zeros. Everything sun-related checks this first.
 */
export function hasSunTimes(d: Pick<WeatherData, "sunrise" | "sunset">): boolean {
  return d.sunrise > 0 && d.sunset > d.sunrise;
}

/** Without sun times, whether it's dark comes from the forecast's own day/night flag. */
export function darkWithoutSunTimes(d: WeatherData): boolean {
  return d.hourly[0]?.isNight ?? false;
}

export type SunEvent = {
  type: "sunrise" | "sunset";
  time: number;
};

/**
 * Sunrises and sunsets around now. Uses the provider's per-day times when it
 * has them; otherwise shifts today's by whole days, which is off by only a
 * minute or two per day.
 */
const eventsCache = new WeakMap<WeatherData, SunEvent[]>();

/** Every frame of the timeline asks for these, so they're worked out once per forecast. */
function allEvents(d: WeatherData): SunEvent[] {
  let events = eventsCache.get(d);
  if (!events) {
    events = computeEvents(d);
    eventsCache.set(d, events);
  }
  return events;
}

function computeEvents(d: WeatherData): SunEvent[] {
  if (!hasSunTimes(d)) return [];
  const events: SunEvent[] = [];
  for (let k = -1; k <= 2; k++) {
    const key = localDay(d.sunrise + k * 86400, d.timezone);
    const day = d.daily.find((x) => localDay(x.time, d.timezone) === key);
    events.push({ type: "sunrise", time: day?.sunrise ?? d.sunrise + k * 86400 });
    events.push({ type: "sunset", time: day?.sunset ?? d.sunset + k * 86400 });
  }
  return events.sort((a, b) => a.time - b.time);
}

/** Sunrise and sunset events falling within [from, to]. */
export function sunEvents(d: WeatherData, from: number, to: number): SunEvent[] {
  return allEvents(d).filter((e) => e.time >= from && e.time <= to);
}

/** Night spans (sunset → sunrise) clipped to [from, to]. */
export function nightSpans(d: WeatherData, from: number, to: number): [number, number][] {
  const events = allEvents(d);
  const spans: [number, number][] = [];
  events.forEach((e, i) => {
    if (e.type !== "sunset") return;
    const rise = events.slice(i + 1).find((x) => x.type === "sunrise");
    if (!rise) return;
    const start = Math.max(e.time, from);
    const end = Math.min(rise.time, to);
    if (end > start) spans.push([start, end]);
  });
  return spans;
}

/** Sunrise and sunset of the local day containing `ts`; null when there are none (polar). */
export function sunTimesOn(d: WeatherData, ts: number): { sunrise: number; sunset: number } | null {
  const key = localDay(ts, d.timezone);
  const onDay = allEvents(d).filter((e) => localDay(e.time, d.timezone) === key);
  const sunrise = onDay.find((e) => e.type === "sunrise")?.time;
  const sunset = onDay.find((e) => e.type === "sunset")?.time;
  return sunrise != null && sunset != null ? { sunrise, sunset } : null;
}
