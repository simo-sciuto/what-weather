"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { MAP_TUNING } from "@/lib/map-tuning";
import type { MapOption } from "@/lib/map-options";
import { RECORD_ACCENT } from "@/lib/record/inks";
import { mapInksFor } from "@/lib/weather/palette";
import { sunPosition } from "@/lib/weather/sun-position";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMoment } from "../time/TimeContext";
import { loadMapbox } from "../weather/MapContext";
import { STYLE, activeLayers, syncMap } from "../weather/map-style";

/**
 * The land around the place (WTH-216): the site's own map, drawn as the page draws it (`STYLE`, `syncMap`, the
 * colours opposite the sky of the moment), but showing the land and not the city: water, green, the relief shaded by
 * the sun, the contour lines and the main roads; no streets, no buildings. The map can be moved and zoomed. The place
 * is the poster's red ring.
 */
const LAND: readonly MapOption[] = ["water", "green", "relief", "contours", "main-roads", "motorways"];
const LAYERS = activeLayers(LAND);
/** About 85 km across on a wide screen: the reach of the peaks and lakes the page names (25 and 35 km around) */
const ZOOM = 10;
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export function TerritoryMap({ lat, lon, name }: { lat: number; lon: number; name: string }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const [shown, setShown] = useState(false);
  const [failed, setFailed] = useState(!TOKEN);
  const { frame, look } = useMoment();
  const inks = useMemo(
    () => mapInksFor(look.palette.sky2, MAP_TUNING, LAYERS, look.palette.air),
    [look.palette.sky2, look.palette.air],
  );
  const sun = useMemo(() => sunPosition(frame.time, lat, lon), [frame.time, lat, lon]);

  useEffect(() => {
    const el = box.current;
    if (!el || !TOKEN) return;
    let map: import("mapbox-gl").Map | undefined;
    let cancelled = false;
    void loadMapbox()
      .then((mapboxgl) => {
        if (cancelled) return;
        map = new mapboxgl.Map({
          container: el,
          accessToken: TOKEN,
          style: STYLE,
          center: [lon, lat],
          zoom: ZOOM,
          minZoom: 6,
          maxZoom: 14,
          // Moved and zoomed with the hand, but never turned or tilted: north stays up
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          fadeDuration: 0,
        });
        map.touchZoomRotate.disableRotation();
        mapRef.current = map;
        // The place: the poster's red ring, a dot at its middle
        const ring = document.createElement("div");
        ring.style.cssText = `width:18px;height:18px;border:2px solid ${RECORD_ACCENT};border-radius:50%;display:grid;place-items:center`;
        const dot = document.createElement("div");
        dot.style.cssText = `width:4px;height:4px;border-radius:50%;background:${RECORD_ACCENT}`;
        ring.append(dot);
        new mapboxgl.Marker({ element: ring }).setLngLat([lon, lat]).addTo(map);
        map.once("idle", () => {
          if (!cancelled) setShown(true);
        });
        // A style that fails to load falls back to the facts alone; a stray tile error once it is drawn does not
        map.on("error", () => {
          if (!cancelled && !map?.loaded()) setFailed(true);
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, [lat, lon]);

  // The colours of the moment, and the sun for the relief's shade
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !shown) return;
    syncMap(m, { inks, options: LAND, sun, lat });
  }, [inks, sun, lat, shown]);

  if (failed) return null;
  return (
    <section aria-label={`La mappa del territorio di ${name}`} className="sheet on-sky">
      <div
        ref={box}
        className={`aspect-[4/3] w-full overflow-hidden rounded-sm transition-opacity duration-1000 sm:aspect-[16/10] lg:aspect-[16/8] ${shown ? "opacity-100" : "opacity-0"}`}
      />
    </section>
  );
}
