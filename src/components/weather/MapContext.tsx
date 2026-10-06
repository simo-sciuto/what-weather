"use client";

import { fetchClouds } from "@/lib/api/clouds";
import type { CloudGrid, Mapbox } from "@/types/map";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePlace } from "../location/PlaceContext";
import { loadMapbox } from "./mapbox-loader";

/**
 * Everything the page's maps share: where they centre (the place on show),
 * its time zone, the Mapbox token, Mapbox GL itself (loaded once, however
 * many maps ask) and the cloud grid the chapter map animates (fetched once
 * per place). The backdrop behind the page and the map chapter both read
 * from here.
 */

type MapState = {
  /** The place the maps centre on */
  center: { lat: number; lon: number; name: string };
  timezone: string;
  /** The credit the weather data's licence asks for on the poster (WTH-212) */
  weatherCredit?: string;
  /** Mapbox public token; without it there are no maps */
  token: string | undefined;
  /** Mapbox GL, once for every map; rejects without WebGL */
  loadMapbox: () => Promise<Mapbox>;
  /** Clouds and rain around the place, hour by hour; null until they arrive (or when they can't) */
  clouds: CloudGrid | null;
};

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const MapContext = createContext<MapState | null>(null);

export function MapProvider({ timezone, weatherCredit, children }: { timezone: string; weatherCredit?: string; children: ReactNode }) {
  const { place } = usePlace();
  const { lat, lon, name } = place;
  const center = useMemo(() => ({ lat, lon, name }), [lat, lon, name]);

  const key = `${lat},${lon}`;
  const [clouds, setClouds] = useState<{ key: string; grid: CloudGrid } | null>(null);
  useEffect(() => {
    let current = true;
    void fetchClouds(lat, lon).then((grid) => {
      if (current && grid) setClouds({ key, grid });
    });
    return () => {
      current = false;
    };
  }, [lat, lon, key]);
  // A grid for another place (before the new one arrives) is never shown
  const grid = clouds?.key === key ? clouds.grid : null;

  const value = useMemo<MapState>(
    () => ({ center, timezone, weatherCredit, token: TOKEN, loadMapbox, clouds: grid }),
    [center, timezone, weatherCredit, grid],
  );
  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

export function useMap(): MapState {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error("useMap must be used inside <MapProvider>");
  return ctx;
}
