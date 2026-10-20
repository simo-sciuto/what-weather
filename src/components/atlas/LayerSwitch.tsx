"use client";

import { inRegion, LAYER_NAMES, LAYERS, type AtlasLayer } from "@/lib/atlas/layers";
import type { AtlasEngine } from "@/lib/atlas/engine";
import { memo, useId } from "react";
import { useAtlasPoint } from "./useAtlasTime";

/**
 * The three layers, one at a time (WTH-346, DESIGN_SYSTEM.md "LayerSwitch"): a group of three native radios, so the
 * arrows move between them and the choice is said; the three names always in view, so the budget of three is a rule
 * anyone can see. The chosen one is marked by its fill and an underline in the accent, not by colour alone. Away from
 * the region Territorio and Percorsi have no data yet: they are off, and a line says why.
 */
export const LayerSwitch = memo(function LayerSwitch({
  engine,
  layer,
  chosen = layer,
  onLayer,
}: {
  engine: AtlasEngine | null;
  /** The layer on show: Meteo away from the region, whatever was chosen */
  layer: AtlasLayer;
  /** The layer the person chose, kept for coming back to the region */
  chosen?: AtlasLayer;
  onLayer: (layer: AtlasLayer) => void;
}) {
  const name = useId();
  const point = useAtlasPoint(engine);
  const here = !point || inRegion(point.cell.lat, point.cell.lon);
  return (
    <div className="pointer-events-auto absolute inset-x-[max(1rem,env(safe-area-inset-left))] bottom-[calc(var(--dock-room)+4.25rem)] z-20 mx-auto flex max-w-[44rem] flex-col items-center gap-1.5">
      <fieldset data-atlas-layers className="m-0 flex rounded-[10px] border border-white/14 bg-surface-1 p-[3px] backdrop-blur-md motion-reduce:backdrop-blur-none">
        <legend className="sr-only">Strato della mappa</legend>
        {LAYERS.map((l) => {
          const off = l !== "meteo" && !here;
          return (
            <label
              key={l}
              className="relative cursor-pointer flex min-h-11 items-center rounded-[8px] px-3.5 text-sm text-ink-muted has-checked:bg-white/14 has-checked:text-ink has-checked:shadow-[inset_0_-2px_0_var(--accent)] has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-accent has-disabled:cursor-not-allowed has-disabled:opacity-50"
            >
              <input type="radio" name={name} value={l} checked={layer === l} disabled={off} onChange={() => onLayer(l)} className="absolute inset-0 m-0 cursor-pointer opacity-0" />
              {LAYER_NAMES[l]}
            </label>
          );
        })}
      </fieldset>
      {!here ? (
        <p role="status" data-atlas-layers-note className="rounded-[10px] bg-surface-1 px-3 py-1 text-xs text-ink">
          Territorio e percorsi: per ora Piemonte e Alpi occidentali.{chosen !== "meteo" ? ` Qui la mappa è Meteo; ${chosen === "territorio" ? "Territorio" : "Percorsi"} torna in regione.` : ""}
        </p>
      ) : layer === "percorsi" ? (
        <p role="status" data-atlas-layers-note className="rounded-[10px] bg-surface-1 px-3 py-1 text-xs text-ink">
          I sentieri arrivano presto: per ora il rilievo e le strade su cui passano.
        </p>
      ) : null}
    </div>
  );
});
