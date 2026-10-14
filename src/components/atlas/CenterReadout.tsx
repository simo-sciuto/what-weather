"use client";

import { formatCenter } from "@/lib/atlas/center";
import type { CameraPort } from "@/types/atlas";
import { useEffect, useRef } from "react";
import { countRender } from "./atlas-test";

/**
 * The map's centre in coordinates, as it is now: written into the page's text as the map moves (the frames of a
 * movement are heard by the port, and the text is set directly, so nothing renders for a frame). A second line, for the
 * screen reader, says the centre once, when a movement ends: it is not read out while the map moves.
 */
export function CenterReadout({ port }: { port: CameraPort | null }) {
  countRender("readout");
  const line = useRef<HTMLSpanElement>(null);
  const spoken = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!port) return;
    const show = () => {
      const { lng, lat } = port.get();
      if (line.current) line.current.textContent = formatCenter(lng, lat);
    };
    show();
    return port.subscribe(
      (e) => {
        show();
        if (e.type === "moveend" && spoken.current) {
          const { lng, lat } = e.camera;
          spoken.current.textContent = `Centro della mappa: ${formatCenter(lng, lat)}`;
        }
      },
      { frames: true },
    );
  }, [port]);

  return (
    <div className="pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-10">
      <p className="mb-1 border-t border-white/25 pt-1 text-[0.6875rem] uppercase tracking-[0.14em] text-ink-muted">Centro della mappa</p>
      <span ref={line} data-atlas-readout aria-hidden="true" className="block text-caption tabular-nums text-ink" />
      <p ref={spoken} aria-live="polite" className="sr-only" />
    </div>
  );
}
