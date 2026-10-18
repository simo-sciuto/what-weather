"use client";

import type { AtlasEngine } from "@/lib/atlas/engine";
import { skyFor } from "@/lib/atlas/sky";
import type { CameraPort, PointSky } from "@/types/atlas";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { ATLAS_SKY } from "./atlas-look";
import { useRestingZoom } from "./useRestingZoom";

/**
 * Works out the sky the Atlas wears (M5, phase A) and hands it to the shell: the point on show and the zoom it rests
 * at (`useRestingZoom`), mixed by `skyFor`. It draws nothing. The point changes only when an answer is applied, so while
 * the map moves, waits or loads, and after a failure, the previous sky stays whole. The page's own transition
 * (`.atmosphere`) dissolves the three stops of the gradient only; the other colours and the map's inks change at once
 * (WTH-270).
 */
export function SkyDriver({ port, engine, onSky }: { port: CameraPort | null; engine: AtlasEngine | null; onSky: (sky: PointSky) => void }) {
  const zoom = useRestingZoom(port, engine);
  const point = useSyncExternalStore(
    (listener) => engine?.subscribe(listener) ?? (() => {}),
    () => engine?.getSnapshot().point ?? null,
    () => null,
  );
  const sky = useMemo(() => skyFor(point, zoom, ATLAS_SKY), [point, zoom]);
  useEffect(() => onSky(sky), [sky, onSky]);
  return null;
}
