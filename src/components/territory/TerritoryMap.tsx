"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { MAP_TUNING } from "@/lib/map-tuning";
import type { MapOption } from "@/lib/map-options";
import { RECORD_ACCENT } from "@/lib/record/inks";
import { mapInksFor } from "@/lib/weather/palette";
import { sunPosition } from "@/lib/weather/sun-position";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMoment } from "../time/TimeContext";
import { STYLE, activeLayers, syncMap, type MapScene } from "../weather/map-style";
import { loadMapbox } from "../weather/mapbox-loader";

/**
 * The land around the place (WTH-216): the site's own map, drawn as the page draws it (`STYLE`, `syncMap`, the
 * colours opposite the sky of the moment), but showing the land and not the city: water, green, the relief shaded by
 * the sun, the contour lines and the main roads; no streets, no buildings. The viewer's own tuning of the weather
 * map's colours does not reach it (this page has no controls for it): the colours are the default ones. The map can
 * be moved and zoomed, never turned. The place is the poster's red ring.
 */
const LAND: readonly MapOption[] = ["water", "green", "relief", "contours", "main-roads", "motorways"];
const LAYERS = activeLayers(LAND);
/** About 85 km across on a wide screen: the reach of the peaks and lakes the page names (25 and 35 km around) */
const ZOOM = 10;
/** A map that has drawn nothing by now (offline, tiles blocked, no error to say so) gives its place back to the facts */
const GIVE_UP_MS = 20_000;
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/** The words Mapbox puts over a map that asks for two fingers or the control key, in Italian */
const LOCALE = {
  "ScrollZoomBlocker.CtrlMessage": "Usa Ctrl + scorrimento per ingrandire la mappa",
  "ScrollZoomBlocker.CmdMessage": "Usa ⌘ + scorrimento per ingrandire la mappa",
  "TouchPanBlocker.Message": "Usa due dita per spostare la mappa",
  "NavigationControl.ZoomIn": "Ingrandisci",
  "NavigationControl.ZoomOut": "Riduci",
};

/** An error that means there is no map to draw (a refused token, a style that did not load), not one lost tile */
function isFatal(event: unknown, styleLoaded: boolean): boolean {
  const status = (event as { error?: { status?: number } }).error?.status;
  return !styleLoaded || status === 401 || status === 403;
}

export function TerritoryMap({ lat, lon, name }: { lat: number; lon: number; name: string }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const styled = useRef(false);
  const [shown, setShown] = useState(false);
  const [failed, setFailed] = useState(!TOKEN);
  const { frame, look } = useMoment();
  const inks = useMemo(
    () => mapInksFor(look.palette.sky2, MAP_TUNING, LAYERS, look.palette.air),
    [look.palette.sky2, look.palette.air],
  );
  const sun = useMemo(() => sunPosition(frame.time, lat, lon), [frame.time, lat, lon]);
  // The scene as the moment on show asks for it: read when the style arrives, and applied again when it changes
  const scene = useRef<MapScene>({ inks, options: LAND, sun, lat });

  useEffect(() => {
    const el = box.current;
    if (!el || !TOKEN) return;
    let map: import("mapbox-gl").Map | undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    styled.current = false;

    const giveUp = () => {
      if (cancelled) return;
      map?.remove();
      mapRef.current = null;
      map = undefined;
      setFailed(true);
    };

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
          // The page scrolls past it: two fingers, or the control key, to move and zoom it; buttons for the rest
          cooperativeGestures: true,
          locale: LOCALE,
          // Moved and zoomed, never turned or tilted: north stays up
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          fadeDuration: 0,
        });
        map.touchZoomRotate.disableRotation();
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
        mapRef.current = map;
        // The place: the poster's red ring, a dot at its middle
        const ring = document.createElement("div");
        ring.style.cssText = `width:18px;height:18px;border:2px solid ${RECORD_ACCENT};border-radius:50%;display:grid;place-items:center`;
        const dot = document.createElement("div");
        dot.style.cssText = `width:4px;height:4px;border-radius:50%;background:${RECORD_ACCENT}`;
        ring.append(dot);
        new mapboxgl.Marker({ element: ring }).setLngLat([lon, lat]).addTo(map);
        // The colours go on as soon as the style is there, before anything is shown: the map appears in them,
        // not in the style's own and then in theirs
        map.once("style.load", () => {
          if (cancelled || !map) return;
          styled.current = true;
          syncMap(map, scene.current);
          map.once("idle", () => {
            if (cancelled) return;
            clearTimeout(timer);
            setShown(true);
          });
        });
        // A lost tile is not the end of a map the viewer moves: only a refused token or a style that failed is
        map.on("error", (event) => {
          if (isFatal(event, styled.current)) giveUp();
        });
        timer = setTimeout(giveUp, GIVE_UP_MS);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      map?.remove();
      mapRef.current = null;
    };
  }, [lat, lon]);

  // The colours of the moment and the sun for the relief's shade, as the moment on show changes
  useEffect(() => {
    scene.current = { inks, options: LAND, sun, lat };
    const m = mapRef.current;
    if (m && styled.current) syncMap(m, scene.current);
  }, [inks, sun, lat]);

  if (failed) return null;
  return (
    <section aria-label={`La mappa del territorio di ${name}`}>
      {/* The map's canvas takes the keyboard: the ring shows where it is */}
      <div
        ref={box}
        className={`aspect-[4/3] w-full overflow-hidden rounded-sm transition-opacity duration-1000 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent sm:aspect-[16/10] lg:aspect-[16/8] ${shown ? "opacity-100" : "opacity-0"}`}
      />
    </section>
  );
}
