"use client";

import { atlasHref, placeRefOf } from "@/lib/atlas/links";
import type { AtlasEngine } from "@/lib/atlas/engine";
import { sharedHref } from "@/lib/sections";
import { useMemo, useSyncExternalStore } from "react";
import { Dock, type DockItem } from "./Dock";

const NONE = { status: null, point: null } as const;

/**
 * The bar on the Atlas route (ADR-029): Esplora is the section on show, Meteo and Crea are links to the page `/`
 * for the point on show (its cell, and the town's name only when the cell is inside it), or to the page with no place
 * when no point has arrived yet. Until D6 brings the map into the page this is how the bar reaches the other sections
 * from here. It follows the engine's snapshot, which changes with the point and the status, never with a frame of the
 * movement.
 */
export function AtlasDock({ engine }: { engine: AtlasEngine | null }) {
  const snap = useSyncExternalStore(
    (listener) => engine?.subscribe(listener) ?? (() => {}),
    () => engine?.getSnapshot() ?? NONE,
    () => NONE,
  );
  const point = snap.point;
  const items = useMemo<DockItem[]>(() => {
    const place = point ? placeRefOf(point) : null;
    return [
      { id: "meteo", href: place ? sharedHref("meteo", place) : "/" },
      // The current section: a link to itself that does nothing, so the map is not asked for again
      { id: "esplora", href: point ? atlasHref(point.cell) : "/atlas", onSelect: () => undefined },
      { id: "crea", href: place ? sharedHref("crea", place) : "/#crea" },
    ];
  }, [point]);
  return <Dock current="esplora" items={items} />;
}
