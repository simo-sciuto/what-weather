"use client";
import { ACTION_LABELS } from "@/constants/labels";
import { mapInksFor } from "@/lib/weather/palette";
import type { SkyPalette } from "@/types/palette";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMoment } from "../time/TimeContext";
import { useMap } from "./MapContext";
import { activeLayers } from "@/lib/map/map-style";
import { GLASS } from "../layout/glass";
import { MapPanelContent, RESET_LINK, useMapOptions, useMapTuning, useResetMap } from "../atlas/MapPanel";

export { MapPanelContent, RESET_LINK, useMapOptions, useResetMap };

/**
 * The palette of the moment on show with the map's lines as the viewer tuned
 * them. The sky is never touched: only the city drawn over it. The map
 * behind the page and the poster both draw from here, so what is seen is
 * what is downloaded.
 */
export function useMapPalette(): SkyPalette {
  const { palette } = useMoment().look;
  const tuning = useMapTuning();
  const options = useMapOptions();
  // The colours are worked out for the layers on show, so no two of them are alike
  const active = useMemo(() => activeLayers(options), [options]);
  return useMemo(
    () => ({ ...palette, map: mapInksFor(palette.sky2, tuning, active, palette.air) }),
    [palette, tuning, active],
  );
}

/**
 * "La mappa", one button that opens one panel for everything the viewer may
 * change about the map behind the page: which layers it shows (the water and
 * the roads, and the extras to add, all as choices side by side) and the
 * colours it is drawn in (three sliders). The panel floats over the page
 * without covering it or darkening it, so the map can be seen changing as it
 * is changed. Without Mapbox there is no map, and so no controls.
 */
export function MapControls({ className = "" }: { className?: string }) {
  const { token } = useMap();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!token) return null;
  return (
    <div className={className}>
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="group inline-flex items-baseline gap-3 whitespace-nowrap text-left font-display text-[0.9375rem] sm:text-xl font-medium leading-none tracking-[-0.02em] transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent text-ink aria-expanded:text-accent"
      >
        Personalizza la mappa
        <span
          aria-hidden="true"
          className="font-sans text-base font-normal text-ink-muted transition-[transform,color] group-hover:translate-x-1 group-hover:text-accent"
        >
          →
        </span>
      </button>
      {/* In the body, not here: a parent's blur or transform would make "fixed" mean "fixed to the parent" */}
      {open &&
        createPortal(
          <MapPanel
            id={panelId}
            onClose={() => {
              setOpen(false);
              trigger.current?.focus();
            }}
          />,
          document.body,
        )}
    </div>
  );
}

/** On a computer, the map's colours and layers in a panel of glass floating over the foot of the page */
function MapPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { custom, reset } = useResetMap();
  return (
    <div
      id={id}
      role="dialog"
      aria-label="La mappa"
      className={`fixed bottom-6 left-1/2 z-50 max-h-[78dvh] w-[min(40rem,calc(100vw-3rem))] -translate-x-1/2 overflow-y-auto rounded-[1.75rem] p-6 text-left text-ink ${GLASS}`}
    >
      <div className="flex items-baseline justify-between gap-4 pb-3">
        <h2 className="font-display text-xl font-bold leading-none tracking-[-0.03em]">
          La mappa
        </h2>
        <div className="flex items-baseline gap-5 text-sm">
          {custom && (
            <button type="button" onClick={reset} className={RESET_LINK}>
              Torna agli automatici
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            {ACTION_LABELS.close}
          </button>
        </div>
      </div>
      <MapPanelBody />
    </div>
  );
}

/**
 * What may be changed about the map: its colours first, three sliders on one row, so the map is seen
 * changing as they move; then the layers, as colour chips in three groups (the city, what to add, the ways
 * of getting about), each chip the colour the layer has on the map, full when on. A line at the foot says
 * what the chip under the pointer does.
 */
function MapPanelBody() {
  return <MapPanelContent mapPalette={useMapPalette()} />;
}
