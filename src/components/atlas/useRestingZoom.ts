"use client";

import { ATLAS_START } from "@/constants/atlas";
import type { AtlasEngine } from "@/lib/atlas/engine";
import type { CameraPort } from "@/types/atlas";
import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * The zoom the Atlas shows things at (the sky's weight, the name's precision): the map's own, to a quarter of a level,
 * read at `moveend` and never for a frame, and taken only when the Atlas is at rest again with the point it asked for.
 * While the map moves, waits or loads, and after a failure, it is the zoom of the point on show, so nothing the zoom
 * decides changes for a stop whose point never came.
 */
export function useRestingZoom(port: CameraPort | null, engine: AtlasEngine | null): number {
  const phase = useSyncExternalStore(
    (listener) => engine?.subscribe(listener) ?? (() => {}),
    () => engine?.getSnapshot().status.phase ?? "resting",
    () => "resting",
  );
  const [zoom, setZoom] = useState<number>(ATLAS_START.zoom);
  const [applied, setApplied] = useState<number>(ATLAS_START.zoom);

  useEffect(() => {
    if (!port) return;
    const read = () => setZoom(Math.round(port.get().zoom * 4) / 4);
    read();
    return port.subscribe((event) => {
      if (event.type === "moveend") read();
    });
  }, [port]);

  if (phase === "resting" && applied !== zoom) setApplied(zoom);
  return applied;
}
