"use client";

import { SEARCH_ZOOM } from "@/constants/atlas";
import { createAtlasEngine, type AtlasEngine } from "@/lib/atlas/engine";
import { distanceKm, flightMs } from "@/lib/atlas/flight";
import { cellOf } from "@/lib/atlas/cell";
import { createPointFetcher } from "@/lib/atlas/point-client";
import type { AddressWriter } from "@/lib/atlas/address";
import type { AtlasPoint, CameraPort } from "@/types/atlas";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";

/** The sample weather's parameters, handed on from the address to the request (tests and the home page's `?mock`) */
const PASSED = ["mock", "at"] as const;

function passedParams(): Record<string, string> {
  const search = new URLSearchParams(window.location.search);
  return Object.fromEntries(PASSED.flatMap((k) => (search.has(k) ? [[k, search.get(k)!]] : [])));
}

/**
 * The Atlas's engine for the life of the shell (M4, ADR-022): made once the map is, ended with it. It hears the camera
 * through the port, asks for the point the map rests on after the quiet, and writes the point that arrived into the
 * address (`router.replace`, in a transition, the page's server render holds no weather so it is cheap). It asks once
 * on opening, for the point the map opens on (the one the address names, or the Atlas's own start). The camera never reaches React:
 * the engine's snapshot changes with the status and the point, a few times per stop.
 */
export function useAtlasEngine(port: CameraPort | null, address: AddressWriter): { engine: AtlasEngine | null; goTo: (target: { lat: number; lon: number }) => void } {
  const router = useRouter();
  const [engine, setEngine] = useState<AtlasEngine | null>(null);
  const routerRef = useRef(router);
  // A point that comes from a search is pushed into the address (the Back button returns to where the person was); the others replace it
  const pushFor = useRef<string | null>(null);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    const made = createAtlasEngine({
      fetchPoint: createPointFetcher({ extra: passedParams }),
      onPoint: (point: AtlasPoint) => {
        const now = new URLSearchParams(address.current());
        const same = Number(now.get("lat")) === point.cell.lat && Number(now.get("lon")) === point.cell.lon;
        if (same) return;
        // One writer for the address: the moment and the layer asked for meanwhile stay (the reviewer's I1)
        const search = address.next((params) => {
          // A free point is its coordinates: a name carried by an old link does not follow it
          for (const key of ["name", "region", "country"]) params.delete(key);
          params.set("lat", String(point.cell.lat));
          params.set("lon", String(point.cell.lon));
        });
        // pushed only for the cell the search asked for; any point that arrives clears the flag
        const how = pushFor.current === `${point.cell.lat},${point.cell.lon}` ? "push" : "replace";
        pushFor.current = null;
        startTransition(() => routerRef.current[how](`/?${search}`, { scroll: false }));
      },
    });
    setEngine(made);
    return () => {
      made.dispose();
      setEngine(null);
    };
  }, [address]);

  useEffect(() => {
    if (!engine || !port) return;
    const stop = port.subscribe((event) => engine.controller.onCamera(event));
    const start = port.get();
    engine.controller.select(cellOf(start.lng, start.lat));
    return stop;
  }, [engine, port]);

  /**
   * A city the person searched for (WTH-274): the map flies there at once, with the flight's length following the
   * distance, and the point's weather is asked for on the spot, so it is there when the map lands. The flight is the
   * code's move, so a hand on the map cuts it short, and a person who prefers less motion has a jump.
   */
  const goTo = useCallback(
    (target: { lat: number; lon: number }) => {
      if (!engine || !port) return;
      const here = port.get();
      pushFor.current = `${cellOf(target.lon, target.lat).lat},${cellOf(target.lon, target.lat).lon}`;
      port.flyTo(
        { lng: target.lon, lat: target.lat, zoom: SEARCH_ZOOM },
        { durationMs: flightMs(distanceKm({ lat: here.lat, lon: here.lng }, target)), reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches },
      );
      engine.controller.select(cellOf(target.lon, target.lat));
    },
    [engine, port],
  );

  return { engine, goTo };
}
