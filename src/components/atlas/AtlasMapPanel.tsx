"use client";

import type { PointSky } from "@/types/atlas";
import type { SkyPalette } from "@/types/palette";
import { memo, useEffect, useId, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { MapPanelContent, RESET_LINK, useResetMap } from "./MapPanel";
import { ACTION_LABELS } from "@/constants/labels";
import { ATLAS_PALETTE, useAtlasMapLook } from "./atlas-look";

function SlidersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  );
}

/**
 * The map's colours and layers in the Atlas (WTH-273): the home page's own controls (three sliders for the tint, the
 * intensity and the contrast, and the choice of what to show), the same two stores, so what the viewer chose on the
 * home page is here and the other way round. A button at the top right, beside the search, opens them in a panel of
 * glass over the foot of the screen, which covers little of the map and darkens none of it, so the map is seen changing
 * as the sliders move. Nothing here is the Atlas's own: no new control, no new colour.
 */
export const AtlasMapPanel = memo(function AtlasMapPanel({
  sky,
  tokens,
  open,
  onOpenChange,
}: {
  sky: PointSky;
  /** The Atlas's colour variables: the panel is portalled to the body, out of reach of the shell that sets them */
  tokens: React.CSSProperties;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const setOpen = (value: boolean | ((o: boolean) => boolean)) => onOpenChange(typeof value === "function" ? value(open) : value);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { inks } = useAtlasMapLook(sky);
  // The palette the chips are drawn in: the sky the map is under and the inks the viewer's choices give it
  const palette: SkyPalette = useMemo(() => ({ ...ATLAS_PALETTE, ...sky, map: inks }), [sky, inks]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Escape that another part has taken (the search clearing its field) is not this panel's to close
      if (e.key !== "Escape" || e.defaultPrevented) return;
      onOpenChange(false);
      trigger.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <div className="absolute right-[calc(max(1rem,env(safe-area-inset-right))+3.5rem)] top-[max(1rem,env(safe-area-inset-top))] z-20">
      <button
        ref={trigger}
        type="button"
        aria-label="La mappa: colori e strati"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex size-11 items-center justify-center rounded-full border border-white/14 bg-surface-1 text-ink shadow-[0_8px_22px_rgb(0_0_0/0.28)] backdrop-blur-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        <SlidersIcon className="size-5" />
      </button>
      {open &&
        createPortal(
          <MapPanel
            id={panelId}
            palette={palette}
            tokens={tokens}
            onClose={() => {
              onOpenChange(false);
              trigger.current?.focus();
            }}
          />,
          document.body,
        )}
    </div>
  );
});

/** The panel of the home page's map controls, floating over the foot of the screen */
function MapPanel({ id, palette, tokens, onClose }: { id: string; palette: SkyPalette; tokens: React.CSSProperties; onClose: () => void }) {
  const { custom, reset } = useResetMap();
  return (
    <div
      id={id}
      role="dialog"
      aria-label="La mappa"
      // The Atlas's colour variables live on its root, not on the body this is portalled to: they are set again here
      // A phone: a sheet over the foot of the screen. A computer: a column at the right, so the centre, where the
      // crosshair is, stays free and the map is seen changing beside it
      className={`fixed bottom-[var(--dock-room)] left-1/2 z-50 max-h-[46dvh] w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 overflow-y-auto rounded-[1.75rem] p-5 text-left text-ink lg:bottom-4 lg:left-auto lg:right-4 lg:top-[max(4.5rem,calc(env(safe-area-inset-top)+4rem))] lg:max-h-none lg:w-[24rem] lg:translate-x-0 bg-surface-2 shadow-[0_8px_24px_rgb(0_0_0/0.28)]`}
      style={tokens}
    >
      <div className="flex items-baseline justify-between gap-4 pb-3">
        <h2 className="font-display text-xl font-bold leading-none tracking-[-0.03em]">La mappa</h2>
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
      <MapPanelContent mapPalette={palette} />
    </div>
  );
}
