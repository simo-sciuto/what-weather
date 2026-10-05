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
import { useMoment } from "../time/TimeContext";
import { useMapOptions, useMapPalette } from "../weather/MapControls";
import { useMap } from "../weather/MapContext";
import { currentView } from "../weather/map-view";
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
};

/** The snapshot from its sources: pure, so what goes on a poster can be checked without a page */
export function posterSnapshot({ place, frame, look, timeZone, palette, options, view }: PosterSources): PosterSnapshot {
  return {
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
  return () => posterSnapshot({ place, frame, look, timeZone: timezone, palette, options, view: currentView() });
}
