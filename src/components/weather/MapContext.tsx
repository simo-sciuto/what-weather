"use client";

import type { CloudGrid } from "@/lib/weather/cloud-grid";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePlace } from "../location/PlaceContext";

/**
 * Everything the page's maps share: where they centre (the place on show),
 * its time zone, the Mapbox token, Mapbox GL itself (loaded once, however
 * many maps ask) and the cloud grid the chapter map animates (fetched once
 * per place). The backdrop behind the page and the map chapter both read
 * from here.
 */

type Mapbox = typeof import("mapbox-gl").default;

type MapState = {
  /** The place the maps centre on */
  center: { lat: number; lon: number; name: string };
  timezone: string;
  /** Mapbox public token; without it there are no maps */
  token: string | undefined;
  /** Mapbox GL, once for every map; rejects without WebGL */
  loadMapbox: () => Promise<Mapbox>;
  /** Clouds and rain around the place, hour by hour; null until they arrive (or when they can't) */
  clouds: CloudGrid | null;
};

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

let mapbox: Promise<Mapbox> | null = null;
function loadMapbox(): Promise<Mapbox> {
  mapbox ??= import("mapbox-gl").then(({ default: gl }) => {
    if (!gl.supported?.()) throw new Error("WebGL unavailable");
    return gl;
  });
  return mapbox;
}

/** One request per place, for every map that shows its clouds; forgotten after the grid's own hour. */
const cloudRequests = new Map<string, Promise<CloudGrid | null>>();
function loadClouds(lat: number, lon: number): Promise<CloudGrid | null> {
  const url = `/api/clouds?lat=${lat}&lon=${lon}`;
  let request = cloudRequests.get(url);
  if (!request) {
    request = fetch(url)
      .then((res) => (res.ok ? (res.json() as Promise<CloudGrid>) : null))
      .then((g) => (g?.times?.length ? g : null))
      .catch(() => null);
    cloudRequests.set(url, request);
    setTimeout(() => cloudRequests.delete(url), 60 * 60 * 1000);
  }
  return request;
}

const MapContext = createContext<MapState | null>(null);

export function MapProvider({ timezone, children }: { timezone: string; children: ReactNode }) {
  const { place } = usePlace();
  const { lat, lon, name } = place;
  const center = useMemo(() => ({ lat, lon, name }), [lat, lon, name]);

  const key = `${lat},${lon}`;
  const [clouds, setClouds] = useState<{ key: string; grid: CloudGrid } | null>(null);
  useEffect(() => {
    let current = true;
    void loadClouds(lat, lon).then((grid) => {
      if (current && grid) setClouds({ key, grid });
    });
    return () => {
      current = false;
    };
  }, [lat, lon, key]);
  // A grid for another place (before the new one arrives) is never shown
  const grid = clouds?.key === key ? clouds.grid : null;

  const value = useMemo<MapState>(
    () => ({ center, timezone, token: TOKEN, loadMapbox, clouds: grid }),
    [center, timezone, grid],
  );
  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

export function useMap(): MapState {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error("useMap must be used inside <MapProvider>");
  return ctx;
}
