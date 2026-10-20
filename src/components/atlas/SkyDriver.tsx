"use client";

import { ATLAS_START } from "@/constants/atlas";
import type { AtlasEngine } from "@/lib/atlas/engine";
import { skyFor } from "@/lib/atlas/sky";
import type { TimeStore } from "@/lib/atlas/time-store";
import type { CameraPort, PointSky } from "@/types/atlas";
import { useEffect, useMemo } from "react";
import { ATLAS_SKY } from "./atlas-look";
import { usePointView } from "./useAtlasTime";
import { useRestingZoom } from "./useRestingZoom";

/** Where and when the sun lights the relief: the point on show at the hour on show */
export type SunAt = { time: number; lat: number; lon: number };

/**
 * Works out the sky the Atlas wears (M5, phase A) and hands it to the shell: the hour on show of the point on show
 * (WTH-343) and the zoom it rests at (`useRestingZoom`), mixed by `skyFor`. An hour the point has no forecast for gives
 * the neutral sky, never another hour's colours (ADR-019). It draws nothing. The point changes only when an answer is
 * applied, so while the map moves, waits or loads, and after a failure, the previous sky stays whole. It also says
 * where and when the sun is, for the relief's light.
 */
export function SkyDriver({
  port,
  engine,
  store,
  onSky,
  onSun,
}: {
  port: CameraPort | null;
  engine: AtlasEngine | null;
  store: TimeStore | null;
  onSky: (sky: PointSky) => void;
  onSun?: (sun: SunAt | null) => void;
}) {
  const zoom = useRestingZoom(port, engine);
  const { point, view } = usePointView(engine, store);
  const sky = useMemo(() => (view?.status === "ok" ? skyFor({ sky: view.hour.sky }, zoom, ATLAS_SKY) : ATLAS_SKY), [view, zoom]);
  const time = view?.status === "ok" ? view.hour.time : view?.requested ?? null;
  const lat = point?.cell.lat ?? ATLAS_START.lat;
  const lon = point?.cell.lon ?? ATLAS_START.lng;
  useEffect(() => onSky(sky), [sky, onSky]);
  useEffect(() => onSun?.(time === null ? null : { time, lat, lon }), [time, lat, lon, onSun]);
  return null;
}
