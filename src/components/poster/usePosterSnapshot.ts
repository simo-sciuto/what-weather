"use client";

import type { Place } from "@/types/weather";
import type { Frame } from "@/types/timeline";
import type { FrameLook } from "@/lib/weather/look";
import type { MapOption } from "@/lib/map-options";
import type { SkyPalette } from "@/types/palette";
import { fingerprintOf } from "@/lib/weather/fingerprint";
import { placeParts } from "@/lib/weather/formatters";
import { sunPosition } from "@/lib/weather/sun-position";
import { usePlace } from "../location/PlaceContext";
import { useMoment, useTimeline } from "../time/TimeContext";
import { useMapOptions, useMapPalette } from "../weather/MapControls";
import { useMap } from "../weather/MapContext";
import { currentView } from "../weather/map-view";
import type { RecordInput, RecordProvenance } from "@/lib/record/types";
import type { PosterInput } from "./render-poster";

/**
 * Everything a poster is drawn from but its format and Mapbox: the place, the moment and its fingerprint, the sky,
 * the map's layers and view, the sun and the temperature, taken together at one instant so the clock ticking on or
 * a scrub does not change a poster half drawn.
 */
export type PosterSnapshot = Omit<PosterInput, "format" | "token" | "loadMapbox">;

export type PosterSources = {
  place: Place;
  frame: Frame;
  look: FrameLook;
  /** The place's time zone */
  timeZone: string;
  /** The map's colours as the viewer tuned them: the poster is drawn as the page is */
  palette: SkyPalette;
  options: readonly MapOption[];
  view: PosterInput["view"];
  /** The day's range, when the frame's day is known */
  /** The day's range; `partial` when it covers only part of the day */
  day?: { high: number; low: number; partial?: boolean };
};

/** "2026-10-05", "12:00", "GMT+2" for a moment on the place's clock; the zone as a fixed offset when Intl lacks it */
export function recordClock(ts: number, timeZone: string): { time: string; zone: string } {
  const at = new Date(ts * 1000);
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "shortOffset" }).formatToParts(at);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return { time: `${get("hour")}:${get("minute")}`, zone: get("timeZoneName") || "GMT" };
  } catch {
    return { time: at.toISOString().slice(11, 16), zone: "GMT" };
  }
}

/**
 * The record's facts from the moment on show (WTH-187): the frame's readings, the day's range, the place's clock.
 * Absent readings stay absent, so the poster never prints a reading the provider did not give. A day's stand-in
 * (`Frame.overview`) is a whole day: its feels-like, wind, cloud and rain are fillers of the stand-in, not readings,
 * so they stay out (the atmosphere then takes the condition's own rain or snow, as for any absent rate); its
 * temperature is the day's high.
 */
export function recordInputOf({ place, frame, timeZone, day }: Pick<PosterSources, "place" | "frame" | "timeZone" | "day">): RecordInput {
  const allDay = frame.overview === true;
  const reading = <T,>(v: T) => (allDay ? undefined : v);
  return {
    place: { name: place.name, lat: place.lat, lon: place.lon, ...placeParts(place) },
    date: frame.dayKey,
    ...recordClock(frame.time, timeZone),
    allDay,
    condition: frame.condition,
    intensity: frame.intensity,
    temp: frame.temp,
    feelsLike: reading(frame.feelsLike),
    high: day?.high,
    low: day?.low,
    windSpeed: reading(frame.windSpeed),
    humidity: frame.humidity,
    visibility: frame.visibility,
    cloudCover: reading(frame.cloudCover),
    uv: frame.uv,
    precipitation: reading(frame.precipitation),
    light: frame.light,
    provenance: provenanceOf(frame, day),
  };
}

/** What on the record is not a plain reading (ADR-006): an interpolated hour, a partial day's range, estimated air */
function provenanceOf(frame: PosterSources["frame"], day: PosterSources["day"]): RecordProvenance | undefined {
  const sources = frame.atmosphericSources ?? {};
  const estimated = (["humidity", "visibility"] as const).filter((k) => sources[k] === "estimated");
  const p: RecordProvenance = {
    ...(!frame.measured && !frame.overview ? { interpolated: true } : {}),
    ...(day?.partial ? { partialRange: true } : {}),
    ...(estimated.length ? { estimated } : {}),
  };
  return Object.keys(p).length ? p : undefined;
}

/** The snapshot from its sources: pure, so what goes on a poster can be checked without a page */
export function posterSnapshot({ place, frame, look, timeZone, palette, options, view, day }: PosterSources): PosterSnapshot {
  return {
    record: recordInputOf({ place, frame, timeZone, day }),
    place: { name: place.name, ...placeParts(place), lat: place.lat, lon: place.lon },
    time: frame.time,
    timeZone,
    allDay: frame.overview === true,
    fingerprint: fingerprintOf({ atmosphere: look.atmosphere, inputStatus: look.atmosphereInputStatus }, frame.light),
    palette,
    options: [...options],
    sun: sunPosition(frame.time, place.lat, place.lon),
    view,
    temp: frame.temp,
  };
}

/**
 * The poster's sources, read where the page keeps them (place, moment, map), and `take()` to freeze them into a
 * snapshot when a poster is asked for. A hook, not a context: only the poster reads this, and only on demand, so
 * nothing re-renders for it while the timeline is scrubbed (ADR-008).
 */
export function usePosterSnapshot(): () => PosterSnapshot {
  const { place } = usePlace();
  const { timezone } = useMap();
  const { frame, look } = useMoment();
  const palette = useMapPalette();
  const options = useMapOptions();
  const { timeline } = useTimeline();
  const day = timeline.days.find((d) => d.key === frame.dayKey);
  return () =>
    posterSnapshot({ place, frame, look, timeZone: timezone, palette, options, view: currentView(), day: day && { high: day.high, low: day.low, partial: day.partial } });
}
