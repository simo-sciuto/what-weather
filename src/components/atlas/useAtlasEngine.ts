"use client";

import { createAtlasEngine, type AtlasEngine } from "@/lib/atlas/engine";
import { cellOf } from "@/lib/atlas/cell";
import { createPointFetcher } from "@/lib/atlas/point-client";
import type { AtlasPoint, CameraPort } from "@/types/atlas";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";

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
export function useAtlasEngine(port: CameraPort | null): AtlasEngine | null {
  const router = useRouter();
  const [engine, setEngine] = useState<AtlasEngine | null>(null);
  const routerRef = useRef(router);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    const made = createAtlasEngine({
      fetchPoint: createPointFetcher({ extra: passedParams }),
      onPoint: (point: AtlasPoint) => {
        const search = new URLSearchParams(window.location.search);
        const same = Number(search.get("lat")) === point.cell.lat && Number(search.get("lon")) === point.cell.lon;
        if (same) return;
        // A free point is its coordinates: a name carried by an old link does not follow it
        for (const key of ["name", "region", "country"]) search.delete(key);
        search.set("lat", String(point.cell.lat));
        search.set("lon", String(point.cell.lon));
        startTransition(() => routerRef.current.replace(`/atlas?${search}`, { scroll: false }));
      },
    });
    setEngine(made);
    return () => {
      made.dispose();
      setEngine(null);
    };
  }, []);

  useEffect(() => {
    if (!engine || !port) return;
    const stop = port.subscribe((event) => engine.controller.onCamera(event));
    const start = port.get();
    engine.controller.select(cellOf(start.lng, start.lat));
    return stop;
  }, [engine, port]);

  return engine;
}
