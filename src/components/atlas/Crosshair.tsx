"use client";

import { ATLAS_PADDING } from "@/constants/atlas";
import { centreOffset } from "@/lib/atlas/center";
import type { CameraPort } from "@/types/atlas";
import { useEffect, useRef } from "react";
import { countRender } from "./atlas-test";

/**
 * The mark at the map's centre: four short strokes and a dot, in the page's ink. It sits at the middle of what the
 * map's padding leaves (`centreOffset`), which is where `getCenter()` is. Discreet at rest and clearer while the map
 * moves, by an attribute set on the element as the movement starts and ends, not by rendering: it never renders for a
 * frame of a movement.
 */
export function Crosshair({ port, padding = ATLAS_PADDING }: { port: CameraPort | null; padding?: typeof ATLAS_PADDING }) {
  countRender("crosshair");
  const mark = useRef<HTMLDivElement>(null);
  const { x, y } = centreOffset(padding);

  useEffect(() => {
    if (!port) return;
    const set = (moving: boolean) => mark.current?.setAttribute("data-moving", String(moving));
    return port.subscribe((e) => {
      if (e.type === "movestart") set(true);
      else if (e.type === "moveend") set(false);
    });
  }, [port]);

  return (
    <div
      ref={mark}
      data-atlas-crosshair
      data-moving="false"
      aria-hidden="true"
      className="pointer-events-none absolute z-10 size-11 -translate-x-1/2 -translate-y-1/2 text-ink opacity-60 transition-opacity duration-300 data-[moving=true]:opacity-100 motion-reduce:transition-none"
      style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, filter: "drop-shadow(0 0 2px var(--sky-1))" }}
    >
      <svg viewBox="0 0 44 44" className="size-full" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 2v13M22 29v13M2 22h13M29 22h13" />
        <circle cx="22" cy="22" r="2.5" />
      </svg>
    </div>
  );
}
