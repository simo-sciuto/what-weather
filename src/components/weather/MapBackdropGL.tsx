"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { sunPosition } from "@/lib/weather/sun-position";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMoment } from "../time/TimeContext";
import { useMapOptions, useMapPalette } from "./MapControls";
import { useMap } from "./MapContext";
import { STYLE, syncMap } from "./map-style";
import { BASE_ZOOM, currentView, phoneMap } from "./map-view";

type Pin = { x: number; y: number };

/**
 * Where the city goes on the screen: at the exact centre of the reading, the
 * poster (marked data-map-anchor). Measured, not guessed, so it holds for any
 * window size and any name's length. On a computer the poster is pinned, so
 * where it is on the screen is where it always is. On a phone it scrolls
 * away, so it is measured where it sits at the top of the page: a phone
 * resizes the window as its address bar hides and shows mid-scroll, and a
 * measure taken on the screen then would throw the city off.
 */
function measurePin(): Pin | null {
  const poster = document.querySelector('[data-map-anchor="poster"]')?.getBoundingClientRect();
  if (!poster) return null;
  const pinned = window.matchMedia("(width >= 64rem)").matches;
  const top = pinned ? poster.top : poster.top + window.scrollY;
  return { x: (poster.left + poster.right) / 2, y: top + poster.height / 2 };
}

/** Padding that moves the map's centre (the city) onto the pin. */
function paddingFor({ x, y }: Pin, w: number, h: number) {
  return {
    left: Math.max(0, 2 * x - w),
    right: Math.max(0, w - 2 * x),
    top: Math.max(0, 2 * y - h),
    bottom: Math.max(0, h - 2 * y),
  };
}

/**
 * The city behind the top of the page, drawn by Mapbox on the sky as it is.
 * This renders the whole band (the caller gives its position, size, fade and
 * opacity). Mapbox GL loads once the browser is idle and the band is near the
 * screen, and fades in, with the city beside its name. Without a token or
 * WebGL there is no map: the sky alone is the backdrop.
 */
export function MapBackdropGL({ className }: { className: string }) {
  const { center, token, loadMapbox } = useMap();
  const { lat, lon } = center;
  // The sky's opposite colours, turned as the viewer chose
  const inks = useMapPalette().map;
  // The extra layers the viewer chose, and the sun at the moment on show for their shadows and lights
  const options = useMapOptions();
  const { time } = useMoment().frame;
  const sun = useMemo(() => sunPosition(time, lat, lon), [time, lat, lon]);
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const [failed, setFailed] = useState(!token);
  const [shown, setShown] = useState(false);
  const [pin, setPin] = useState<Pin | null>(null);
  const pinRef = useRef<Pin | null>(null);
  const viewRef = useRef({ zoom: BASE_ZOOM, pitch: 0, bearing: 0 });

  // Measure the pin now and whenever the layout changes (the window, the name itself, the font arriving);
  // move the map to match.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const p = measurePin();
        if (!p) return;
        pinRef.current = p;
        setPin(p);
        const m = mapRef.current;
        const el = box.current;
        if (m && el) m.setPadding(paddingFor(p, el.clientWidth, el.clientHeight));
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    for (const anchor of document.querySelectorAll("[data-map-anchor]")) ro.observe(anchor);
    let live = true;
    void document.fonts?.ready.then(() => live && update());
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);

  // Scrolling down zooms into the city and tilts it: the map stays fixed, so the page seems to descend into
  // it. On a phone the page stays still and the finger does the same, and turns the map too (see MapGestures).
  useEffect(() => {
    let frame = 0;
    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        viewRef.current = currentView();
        mapRef.current?.jumpTo(viewRef.current);
      });
    };
    apply();
    window.addEventListener("scroll", apply, { passive: true });
    window.addEventListener("resize", apply);
    const off = phoneMap.subscribe(apply);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      off();
    };
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el || !token) return;
    let map: import("mapbox-gl").Map | undefined;
    let cancelled = false;
    let idle: number | undefined;

    const start = async () => {
      try {
        const mapboxgl = await loadMapbox();
        if (cancelled) return;
        const { width: w, height: h } = el.getBoundingClientRect();
        map = new mapboxgl.Map({
          container: el,
          accessToken: token,
          style: STYLE,
          center: [lon, lat],
          zoom: viewRef.current.zoom,
          pitch: viewRef.current.pitch,
          bearing: viewRef.current.bearing,
          interactive: false,
          attributionControl: false,
          fadeDuration: 0,
        });
        mapRef.current = map;
        // Shift the view so the city lands on the pin rather than the middle.
        map.setPadding(paddingFor(pinRef.current ?? measurePin() ?? { x: w / 2, y: h / 2 }, w, h));
        let drawn = false;
        map.once("idle", () => {
          drawn = true;
          if (!cancelled) setShown(true);
        });
        // A style that fails to load falls back; a stray tile error once it's drawn doesn't.
        map.on("error", () => {
          if (!cancelled && !drawn) setFailed(true);
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    // Near the screen, then when the browser has a moment: the page first, the backdrop after.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const run = () => void start();
        idle =
          typeof window.requestIdleCallback === "function"
            ? window.requestIdleCallback(run, { timeout: 2000 })
            : (setTimeout(run, 300) as unknown as number);
      },
      { rootMargin: "200px" },
    );
    io.observe(el);

    return () => {
      cancelled = true;
      io.disconnect();
      if (idle != null) {
        if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
        else clearTimeout(idle);
      }
      map?.remove();
      mapRef.current = null;
    };
  }, [lat, lon, token, loadMapbox]);

  // The sky's opposite colours, the chosen layers and the sun, as the moment on show changes
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !shown) return;
    syncMap(m, { inks, options, sun, lat });
  }, [inks, options, sun, lat, shown]);

  // The map is strongest around the pin; once it's measured, the fade follows it.
  const fade = pin
    ? `radial-gradient(ellipse 45vw 50vh at ${pin.x}px ${pin.y}px, #000 15%, rgb(0 0 0 / 0.65) 80%)`
    : undefined;

  if (failed) return null;
  return (
    <div
      className={className}
      style={fade ? { maskImage: fade, WebkitMaskImage: fade } : undefined}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 transition-opacity duration-1000 ${shown ? "opacity-100" : "opacity-0"}`}
      >
        {/* Mapbox sets `position: relative` on its container, so it gets its own full-size box */}
        <div ref={box} className="h-full w-full" />
      </div>
    </div>
  );
}
