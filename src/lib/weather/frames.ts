import type { DayLabel, DayTimeline, Frame, Timeline } from "@/types/timeline";
import { atmosphericData, interpolateAtmosphericData } from "./atmospheric-data";
import { bestWindow, windowLabel } from "./best-window";
import { TYPICAL_CLOUD_COVER } from "./constants";
import { visibleDays } from "./days";
import { formatDate, formatTime, localDay, localHour } from "./formatters";
import { capitalize } from "@/utils/string";
import { daySummary, momentSummary } from "./moments";
import { dayPhase, weatherState } from "./state";
import { nightSpans, sunEvents, sunTimesOn } from "./sun";
import type { AtmosphericMeasurements, Condition, Intensity, WeatherData } from "@/types/weather";

/** How long twilight lasts on the light scale, before sunrise and after sunset */
export const TWILIGHT = 90 * 60;

type Sample = {
  time: number;
  temp: number;
  feelsLike: number;
  condition: Condition;
  intensity: Intensity;
  cloudCover: number;
  precipitation: number;
  precipProbability: number;
  windSpeed: number;
  uvIndex?: number;
  night: boolean;
  measured: boolean;
} & AtmosphericMeasurements;

/**
 * Daylight as one number: 0 at sunrise, 1 at sunset, running below 0 through
 * dawn twilight (−1 = full night) and above 1 through dusk (2 = full night).
 * The palette is keyed on it, so colour changes smoothly across the whole day.
 */
function lightAt(d: WeatherData, ts: number, night: boolean): number {
  const sun = sunTimesOn(d, ts);
  if (!sun) return night ? -1 : 0.45; // polar night / midnight sun
  if (ts < sun.sunrise) return -Math.min((sun.sunrise - ts) / TWILIGHT, 1);
  if (ts > sun.sunset) return 1 + Math.min((ts - sun.sunset) / TWILIGHT, 1);
  return (ts - sun.sunrise) / (sun.sunset - sun.sunrise);
}

/** Rounded for the wire: interpolation leaves values like 5.5440000000000005. */
const round = (x: number, digits: number) => Math.round(x * 10 ** digits) / 10 ** digits;

/**
 * Hourly samples from now to the end of the forecast: provider points as they are, and — when the
 * provider steps in 3-hour blocks — hours in between, interpolated
 * (temperatures, cloud and rain linearly; the sky from the nearer point).
 */
export function hourlySamples(d: WeatherData): Sample[] {
  const now = d.current.time;
  const known: Sample[] = [
    {
      ...atmosphericData(d.current),
      time: now,
      temp: d.current.temp,
      feelsLike: d.current.feelsLike,
      condition: d.current.condition,
      intensity: d.current.intensity,
      cloudCover: d.current.cloudCover,
      precipitation: d.current.precipitation,
      precipProbability: d.hourly[0]?.precipProbability ?? 0,
      windSpeed: d.current.windSpeed,
      uvIndex: d.current.uvIndex,
      night: d.hourly[0]?.isNight ?? false,
      measured: true,
    },
    ...d.hourly
      .filter((h) => h.time > now)
      .map((h) => ({
        ...atmosphericData(h),
        time: h.time,
        temp: h.temp,
        feelsLike: h.feelsLike,
        condition: h.condition,
        intensity: h.intensity,
        cloudCover: h.cloudCover,
        precipitation: h.precipitation,
        precipProbability: h.precipProbability,
        windSpeed: h.windSpeed,
        uvIndex: h.uvIndex,
        night: h.isNight,
        measured: true,
      })),
  ];

  const samples: Sample[] = [known[0]];
  const firstHour = Math.ceil((now + 60) / 3600) * 3600;
  for (let t = firstHour; ; t += 3600) {
    const j = known.findIndex((k) => k.time >= t);
    if (j <= 0) break; // beyond the forecast
    const a = known[j - 1];
    const b = known[j];
    const f = (t - a.time) / (b.time - a.time);
    const lerp = (x: number, y: number) => x + (y - x) * f;
    const near = f < 0.5 ? a : b;
    samples.push({
      ...interpolateAtmosphericData(a, b, f),
      time: t,
      temp: lerp(a.temp, b.temp),
      feelsLike: lerp(a.feelsLike, b.feelsLike),
      condition: near.condition,
      intensity: near.intensity,
      cloudCover: lerp(a.cloudCover, b.cloudCover),
      precipitation: lerp(a.precipitation, b.precipitation),
      precipProbability: lerp(a.precipProbability, b.precipProbability),
      windSpeed: lerp(a.windSpeed, b.windSpeed),
      uvIndex: a.uvIndex != null && b.uvIndex != null ? lerp(a.uvIndex, b.uvIndex) : near.uvIndex,
      night: near.night,
      measured: b.time === t,
    });
  }
  return samples;
}

function relativeDay(d: WeatherData, dayKey: string): string | null {
  const today = localDay(d.current.time, d.timezone);
  if (dayKey === today) return "Oggi";
  if (dayKey === localDay(d.current.time + 86400, d.timezone)) return "Domani";
  return null;
}

function toFrame(d: WeatherData, s: Sample, isNow: boolean, summary: string, timeLabel?: string): Frame {
  const tz = d.timezone;
  const dayKey = localDay(s.time, tz);
  const sun = sunTimesOn(d, s.time);
  const phase = sun ? dayPhase(s.time, sun.sunrise, sun.sunset) : s.night ? "night" : "day";
  return {
    ...atmosphericData(s),
    humidity: s.humidity == null ? undefined : round(s.humidity, 2),
    visibility: s.visibility == null ? undefined : round(s.visibility, 3),
    dewPoint: s.dewPoint == null ? undefined : round(s.dewPoint, 2),
    time: s.time,
    isNow,
    measured: s.measured,
    timeLabel: timeLabel ?? (isNow ? "Adesso" : formatTime(s.time, tz)),
    hour: Math.floor(localHour(s.time, tz)),
    dayKey,
    // Two digits, as the provider gives them: one would round twice (25.46 → 25.5 → 26°) against the raw 25° elsewhere.
    temp: round(s.temp, 2),
    feelsLike: round(s.feelsLike, 2),
    condition: s.condition,
    intensity: s.intensity,
    state: weatherState(s, phase),
    phase,
    light: round(lightAt(d, s.time, s.night), 3),
    cloudCover: Math.round(s.cloudCover),
    precipitation: round(s.precipitation, 2),
    precipProbability: round(s.precipProbability, 2),
    windSpeed: round(s.windSpeed, 1),
    uv: s.uvIndex == null ? undefined : round(s.uvIndex, 1),
    summary,
  };
}

function dayLabel(d: WeatherData, ts: number): DayLabel {
  const tz = d.timezone;
  return {
    weekday: capitalize(formatDate(ts, tz, { weekday: "long" })),
    date: formatDate(ts, tz, { day: "numeric", month: "long" }),
    relative: relativeDay(d, localDay(ts, tz)),
  };
}

/** The "next 24 hours" view: now plus the following 24 hourly frames. */
export const WINDOW = 24;
/** Hours a day needs on the timeline to count as covered (a day lasts 23 to 25; the forecast's last one is cut short). */
export const FULL_DAY = 20;

export function buildTimeline(d: WeatherData): Timeline {
  const tz = d.timezone;
  const samples = hourlySamples(d);
  const days = visibleDays(d);
  const from = samples[0].time;
  const to = samples.at(-1)!.time;
  const sun = sunEvents(d, from, to);

  // Each hour's sentence compares it with now (inside the 24-hour window) or with its own day.
  const window = samples.slice(0, WINDOW + 1).map((s) => s.temp);
  const extremes = { max: Math.max(...window), min: Math.min(...window) };
  const dayRange = new Map(days.map((x) => [x.key, { high: x.point.max, low: x.point.min }]));
  const frames = samples.map((s, i) =>
    toFrame(
      d,
      s,
      i === 0,
      momentSummary(s, {
        timezone: tz,
        nowTemp: samples[0].temp,
        window: i <= WINDOW ? extremes : undefined,
        day: dayRange.get(localDay(s.time, tz)),
        events: sun,
      }),
    ),
  );

  const dayTimelines = days.map((day): DayTimeline => {
    const p = day.point;
    const hours = frames.flatMap((f, i) => (f.dayKey === day.key && (day.isToday || !f.isNow) ? [i] : []));
    const summary = daySummary(p, hours.map((i) => samples[i]), tz);
    // A day the hours only partly cover would name the best of what little they show.
    const window = day.isToday || hours.length >= FULL_DAY ? bestWindow(hours.map((i) => samples[i])) : null;
    const overview = toFrame(
      d,
      {
        time: p.time,
        temp: p.max,
        feelsLike: p.max,
        condition: p.condition,
        intensity: p.intensity,
        cloudCover: TYPICAL_CLOUD_COVER[p.condition],
        precipitation: 0,
        precipProbability: p.precipProbability,
        windSpeed: 0,
        // The day's peak, for the brilliance of its sky
        uvIndex: p.uvIndex,
        night: false,
        measured: false,
      },
      false,
      summary,
      "Tutto il giorno",
    );
    overview.overview = true;
    return {
      key: day.key,
      name: day.name,
      dateLabel: day.dateLabel,
      isToday: day.isToday,
      high: p.max,
      low: p.min,
      summary,
      best: window && { ...window, label: windowLabel(window, tz) },
      hours,
      overview,
    };
  });

  const dayLabels: Record<string, DayLabel> = {};
  for (const f of [...frames, ...dayTimelines.map((x) => x.overview)]) dayLabels[f.dayKey] ??= dayLabel(d, f.time);

  const events = sun.map((e) => ({ ...e, label: formatTime(e.time, tz) }));
  const next = bestWindow(samples.slice(0, WINDOW + 1));
  const best = next && { ...next, label: windowLabel(next, tz, from) };
  return { frames, days: dayTimelines, best, dayLabels, sun: { events, nights: nightSpans(d, from, to) } };
}
