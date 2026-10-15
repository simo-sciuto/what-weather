"use client";

import { ATLAS_START } from "@/constants/atlas";
import type { AtlasEngine } from "@/lib/atlas/engine";
import { skyFor } from "@/lib/atlas/sky";
import type { CameraPort, PointSky } from "@/types/atlas";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ATLAS_SKY } from "./atlas-look";

/**
 * Works out the sky the Atlas wears (M5, phase A) and hands it to the shell: the point on show and the zoom the map
 * rested at when that point was asked for, mixed by `skyFor`. It draws nothing. The point changes only when an answer
 * is applied, and the zoom is taken together with it, once the Atlas is at rest again: while the map moves, waits or
 * loads, and after a failure, the previous sky stays whole (the zoom of a stop whose point never came is not applied
 * to the old point). It hears `moveend`, never a frame, so the sky changes once per stop. The page's own transition
 * (`.atmosphere`) dissolves the three stops of the gradient only; the other colours and the map's inks change at once
 * (WTH-270).
 */
export function SkyDriver({ port, engine, onSky }: { port: CameraPort | null; engine: AtlasEngine | null; onSky: (sky: PointSky) => void }) {
  const point = useSyncExternalStore(
    (listener) => engine?.subscribe(listener) ?? (() => {}),
    () => engine?.getSnapshot().point ?? null,
    () => null,
  );
  const phase = useSyncExternalStore(
    (listener) => engine?.subscribe(listener) ?? (() => {}),
    () => engine?.getSnapshot().status.phase ?? "resting",
    () => "resting",
  );
  // To a quarter of a zoom level: a wheel that ends a hair apart is not a new sky
  const [zoom, setZoom] = useState(ATLAS_START.zoom);
  // The zoom the sky is worked out at: the latest one, taken only when the Atlas is at rest with the point it asked for
  const [applied, setApplied] = useState(ATLAS_START.zoom);

  useEffect(() => {
    if (!port) return;
    const read = () => setZoom(Math.round(port.get().zoom * 4) / 4);
    read();
    return port.subscribe((event) => {
      if (event.type === "moveend") read();
    });
  }, [port]);

  if (phase === "resting" && applied !== zoom) setApplied(zoom);

  const sky = useMemo(() => skyFor(point, applied, ATLAS_SKY), [point, applied]);
  useEffect(() => onSky(sky), [sky, onSky]);
  return null;
}
