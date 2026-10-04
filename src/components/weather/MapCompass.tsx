"use client";

import { tempAccent } from "@/lib/weather/temp-color";
import { useSyncExternalStore, type KeyboardEvent } from "react";
import { useMoment } from "../time/TimeContext";
import { bearingName, bearingPoint, phoneMap } from "./map-view";

/** How far an arrow key turns the map, in degrees */
const KEY_STEP = 15;

/**
 * The compass: where north is on the map as the viewer has turned it, and, beside it, the point the
 * map faces ("NE"). A hairline ring, a needle in the colour of the temperature on show, a small N; the
 * needle turns the other way to the map, so it keeps pointing north. A button: tapped it brings the
 * map back to north, and the left and right arrows turn it (the same turn as dragging across the map).
 */
export function MapCompass({
  className = "",
  sigla = true,
}: {
  className?: string;
  sigla?: boolean;
}) {
  const { frame, look } = useMoment();
  const { bearing } = useSyncExternalStore(
    phoneMap.subscribe,
    phoneMap.get,
    phoneMap.get,
  );
  const color = tempAccent(frame.temp, look.palette.air.saturation);
  const turn = (by: number) =>
    phoneMap.set({ ...phoneMap.get(), bearing: phoneMap.get().bearing + by });

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowLeft") turn(-KEY_STEP);
    else if (e.key === "ArrowRight") turn(KEY_STEP);
    else return;
    e.preventDefault();
  }

  return (
    <button
      type="button"
      onClick={() => phoneMap.set({ ...phoneMap.get(), bearing: 0 })}
      onKeyDown={onKeyDown}
      aria-label={`Bussola: la mappa guarda verso ${bearingName(bearing)}. Tocca per tornare al nord, frecce per girare.`}
      className={`flex items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${className}`}
      style={{ color }}
    >
      <svg
        viewBox="0 0 48 48"
        aria-hidden="true"
        className="size-11 shrink-0 drop-shadow-[0_1px_5px_rgb(0_0_0/0.45)] transition-colors duration-700"
      >
        <circle
          cx="24"
          cy="24"
          r="22"
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.45}
          strokeWidth={1}
        />
        <g
          style={{
            transform: `rotate(${-bearing}deg)`,
            transformOrigin: "24px 24px",
          }}
        >
          <path d="M24 5 27.5 24H20.5Z" fill="currentColor" />
          <path
            d="M24 43 27.5 24H20.5Z"
            fill="currentColor"
            fillOpacity={0.32}
          />
        </g>
        <circle cx="24" cy="24" r="1.4" fill="#0c1026" />
      </svg>
      {sigla && (
        <span
          aria-hidden="true"
          className="min-w-[1.75rem] text-base font-bold uppercase tabular-nums tracking-[0.04em] [text-shadow:0_1px_5px_rgb(0_0_0/0.45)]"
        >
          {bearingPoint(bearing)}
        </span>
      )}
    </button>
  );
}
