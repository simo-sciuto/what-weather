"use client";

import {
  MAP_TUNING,
  isUntuned,
  mapTuningSnapshot,
  parseMapTuning,
  setMapTuning,
  subscribeMapTuning,
  type MapTuning,
} from "@/lib/map-tuning";
import { mapInksFor, mapTone, motorwayHue, type SkyPalette } from "@/lib/weather/palette";
import { useId, useMemo, useSyncExternalStore, type CSSProperties } from "react";
import { useMoment } from "../time/TimeContext";
import { useMap } from "./MapContext";

/** The viewer's tuning of the map's colours; the page's own on the server and until the browser says otherwise. */
function useMapTuning(): MapTuning {
  const raw = useSyncExternalStore(subscribeMapTuning, mapTuningSnapshot, () => "");
  return useMemo(() => parseMapTuning(raw), [raw]);
}

/**
 * The palette of the moment on show with the map's lines as the viewer tuned
 * them. The sky is never touched: only the city drawn over it. The map
 * behind the page and the poster both draw from here, so what is seen is
 * what is downloaded.
 */
export function useMapPalette(): SkyPalette {
  const { palette } = useMoment().look;
  const tuning = useMapTuning();
  return useMemo(
    () => (isUntuned(tuning) ? palette : { ...palette, map: mapInksFor(palette.sky2, tuning) }),
    [palette, tuning],
  );
}

/** Stops along the hue track: the wheel, a full turn from the page's own colour. */
const TURNS = [0, 45, 90, 135, 180, 225, 270, 315, 360];
const gradient = (stops: string[]) => `linear-gradient(90deg, ${stops.join(", ")})`;

/**
 * The map's colours, the viewer's to tune, behind a quiet disclosure: three
 * sliders that each move all the lines together. The hue turns them round
 * the colour wheel from the page's own (opposite the sky); the intensity
 * takes them from white lines to vivid ones; the contrast sets how strongly
 * they stand against the sky. Each track shows what its slider gives. The
 * lines keep their ranks throughout (see mapInks in palette.ts), and the
 * choice is remembered in the browser. Without Mapbox there is no map, and
 * so no controls.
 */
export function MapColors({ className = "" }: { className?: string }) {
  const { token } = useMap();
  const { palette } = useMoment().look;
  const tuning = useMapTuning();
  const id = useId();
  if (!token) return null;

  const hue = motorwayHue(palette.sky2);
  const tone = (vivid: number, turn = tuning.hue) => {
    const { lightness, chroma } = mapTone(vivid);
    return `oklch(${lightness.toFixed(2)} ${chroma.toFixed(3)} ${Math.round(hue + turn)}deg)`;
  };
  const sliders: { key: keyof MapTuning; name: string; max: number; track: string; spoken: string }[] = [
    {
      key: "hue",
      name: "Tinta",
      max: 359,
      track: gradient(TURNS.map((t) => `${tone(tuning.vivid, t)} ${(t / 360) * 100}%`)),
      spoken: tuning.hue === 0 ? "Quella del cielo" : `Ruotata di ${tuning.hue} gradi`,
    },
    {
      key: "vivid",
      name: "Intensità",
      max: 100,
      track: gradient([0, 25, 50, 75, 100].map((v) => `${tone(v)} ${v}%`)),
      spoken: `${tuning.vivid} su 100`,
    },
    {
      key: "contrast",
      name: "Contrasto",
      max: 100,
      track: gradient(["rgb(255 255 255 / 0.15) 0%", "rgb(255 255 255 / 0.95) 100%"]),
      spoken: `${tuning.contrast} su 100`,
    },
  ];

  return (
    <details className={`group text-caption text-ink-muted ${className}`}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm underline decoration-white/35 underline-offset-4 hover:text-ink hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        Colori della mappa
      </summary>
      <div className="mt-2 flex max-w-44 flex-col gap-1.5">
        {sliders.map((s) => (
          <div key={s.key}>
            <label htmlFor={`${id}-${s.key}`} className="block">
              {s.name}
            </label>
            <input
              id={`${id}-${s.key}`}
              type="range"
              min={0}
              max={s.max}
              step={1}
              value={tuning[s.key]}
              onChange={(e) => setMapTuning({ ...tuning, [s.key]: Number(e.target.value) })}
              aria-valuetext={s.spoken}
              className="map-tune h-5 w-full cursor-pointer"
              style={{ "--track": s.track } as CSSProperties}
            />
          </div>
        ))}
        {!isUntuned(tuning) && (
          <button
            type="button"
            onClick={() => setMapTuning(MAP_TUNING)}
            className="self-start rounded-sm underline decoration-white/35 underline-offset-4 hover:text-ink hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Torna agli automatici
          </button>
        )}
      </div>
    </details>
  );
}
