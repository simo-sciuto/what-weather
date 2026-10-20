"use client";

import { NOW_SELECTION } from "@/lib/weather/instant";
import type { AtlasEngine } from "@/lib/atlas/engine";
import { viewOf, type PointView } from "@/lib/atlas/hours";
import type { TimeStore } from "@/lib/atlas/time-store";
import type { AtlasPoint } from "@/types/atlas";
import type { TimeSelection } from "@/types/time";
import { useMemo, useSyncExternalStore } from "react";

/** The Atlas's moment; "Adesso" on the server and until the browser has read the address */
export function useAtlasTime(store: TimeStore | null): TimeSelection {
  return useSyncExternalStore(
    (listener) => store?.subscribe(listener) ?? (() => {}),
    () => store?.get() ?? NOW_SELECTION,
    () => NOW_SELECTION,
  );
}

/** The point on show, changing only when an answer is applied */
export function useAtlasPoint(engine: AtlasEngine | null): AtlasPoint | null {
  return useSyncExternalStore(
    (listener) => engine?.subscribe(listener) ?? (() => {}),
    () => engine?.getSnapshot().point ?? null,
    () => null,
  );
}

/** The point at the moment on show (WTH-343): its hour, or why there is none; null with no point */
export function usePointView(engine: AtlasEngine | null, store: TimeStore | null): { point: AtlasPoint | null; view: PointView | null; selection: TimeSelection } {
  const point = useAtlasPoint(engine);
  const selection = useAtlasTime(store);
  const view = useMemo(() => (point ? viewOf(point, selection) : null), [point, selection]);
  return { point, view, selection };
}
