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
import {
  MAP_OPTIONS,
  MAP_OPTION_INFO,
  DEFAULT_MAP_OPTIONS,
  TRANSIT_OPTIONS,
  isDefaultMapOptions,
  mapOptionsSnapshot,
  parseMapOptions,
  setMapOptions,
  subscribeMapOptions,
  type MapOption,
} from "@/lib/map-options";
import { optionColor } from "@/lib/weather/map-swatch";
import { mapInksFor, mapTone, motorwayHue } from "@/lib/weather/palette";
import type { SkyPalette } from "@/types/palette";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useMoment } from "../time/TimeContext";
import { useMap } from "./MapContext";
import { activeLayers } from "./map-style";
import { GLASS, Sheet } from "../layout/PhoneNav";

/** The viewer's tuning of the map's colours; the page's own on the server and until the browser says otherwise. */
function useMapTuning(): MapTuning {
  const raw = useSyncExternalStore(
    subscribeMapTuning,
    mapTuningSnapshot,
    () => "",
  );
  return useMemo(() => parseMapTuning(raw), [raw]);
}

/** The layers the viewer chose for the map; the page's own on the server and until the browser says otherwise. */
export function useMapOptions(): MapOption[] {
  const raw = useSyncExternalStore(
    subscribeMapOptions,
    mapOptionsSnapshot,
    () => "",
  );
  return useMemo(() => parseMapOptions(raw), [raw]);
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
  const options = useMapOptions();
  // The colours are worked out for the layers on show, so no two of them are alike
  const active = useMemo(() => activeLayers(options), [options]);
  return useMemo(
    () => ({ ...palette, map: mapInksFor(palette.sky2, tuning, active, palette.air) }),
    [palette, tuning, active],
  );
}

/** Stops along the hue track: the wheel, a full turn from the page's own colour. */
const TURNS = [0, 45, 90, 135, 180, 225, 270, 315, 360];
const gradient = (stops: string[]) =>
  `linear-gradient(90deg, ${stops.join(", ")})`;

/** The options that are the city itself, and the extras to add to it */
const CITY_OPTIONS = MAP_OPTIONS.filter((o) => DEFAULT_MAP_OPTIONS.includes(o));
const EXTRA_OPTIONS = MAP_OPTIONS.filter(
  (o) => !DEFAULT_MAP_OPTIONS.includes(o) && !TRANSIT_OPTIONS.includes(o),
);

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
        className="group inline-flex items-baseline gap-3 text-left font-display text-[0.9375rem] sm:text-xl font-medium leading-none tracking-[-0.02em] transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent text-ink aria-expanded:text-accent"
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

/** Back to the page's own map: its layers and its colours, as they were */
function useResetMap() {
  const tuning = useMapTuning();
  const options = useMapOptions();
  const custom = !isUntuned(tuning) || !isDefaultMapOptions(options);
  const reset = () => {
    setMapTuning(MAP_TUNING);
    setMapOptions(DEFAULT_MAP_OPTIONS);
  };
  return { custom, reset };
}

const RESET_LINK =
  "text-ink-muted underline decoration-white/35 underline-offset-4 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";

/**
 * On a phone, the map's colours and layers in a sheet of glass like the data's (see PhoneNav), opened from
 * the bar's map icon. Without Mapbox there is no map, and so no sheet.
 */
export function MapSheet() {
  const { token } = useMap();
  const { custom, reset } = useResetMap();
  if (!token) return null;
  return (
    <Sheet
      name="map"
      title="Mappa"
      actions={
        custom && (
          <button type="button" onClick={reset} className={RESET_LINK}>
            Torna agli automatici
          </button>
        )
      }
    >
      <MapPanelBody />
    </Sheet>
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
            Chiudi
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
  const { palette } = useMoment().look;
  const tuning = useMapTuning();
  const options = useMapOptions();
  const mapPalette = useMapPalette();
  const sliderId = useId();
  // What the choice the viewer is on says it does
  const [hint, setHint] = useState("");

  const hue = motorwayHue(palette.sky2);
  const tone = (vivid: number, turn = tuning.hue) => {
    const { lightness, chroma } = mapTone(vivid);
    return `oklch(${lightness.toFixed(2)} ${chroma.toFixed(3)} ${Math.round(hue + turn)}deg)`;
  };
  const sliders: {
    key: keyof MapTuning;
    name: string;
    max: number;
    track: string;
    spoken: string;
    /** What shows beside the name, short */
    short: string;
  }[] = [
    {
      key: "hue",
      name: "Tinta",
      max: 359,
      track: gradient(
        TURNS.map((t) => `${tone(tuning.vivid, t)} ${(t / 360) * 100}%`),
      ),
      spoken:
        tuning.hue === 0
          ? "Quella del cielo"
          : `Ruotata di ${tuning.hue} gradi`,
      short: `${tuning.hue}°`,
    },
    {
      key: "vivid",
      name: "Intensità",
      max: 100,
      track: gradient([0, 25, 50, 75, 100].map((v) => `${tone(v)} ${v}%`)),
      spoken: `${tuning.vivid} su 100`,
      short: `${tuning.vivid}`,
    },
    {
      key: "contrast",
      name: "Contrasto",
      max: 100,
      track: gradient([
        "rgb(255 255 255 / 0.15) 0%",
        "rgb(255 255 255 / 0.95) 100%",
      ]),
      spoken: `${tuning.contrast} su 100`,
      short: `${tuning.contrast}`,
    },
  ];

  const toggle = (option: MapOption, on: boolean) =>
    setMapOptions(
      MAP_OPTIONS.filter((o) => (o === option ? on : options.includes(o))),
    );

  const group = (label: string, list: readonly MapOption[]) => (
    <div role="group" aria-label={label}>
      <p className="label mb-2.5 flex items-baseline justify-between">
        {label}
        <span className="tabular-nums">
          {list.filter((o) => options.includes(o)).length} di {list.length}
        </span>
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-x-2 gap-y-3">
        {list.map((option) => (
          <Chip
            key={option}
            on={options.includes(option)}
            onChange={(on) => toggle(option, on)}
            color={optionColor(mapPalette, option)}
            onPoint={(on) => setHint(on ? MAP_OPTION_INFO[option].hint : "")}
            label={MAP_OPTION_INFO[option].label}
          />
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* The three colours first, on one row, so the map is seen changing as they move */}
      <section
        aria-label="Colori"
        className="grid grid-cols-3 gap-x-4 pt-3 sm:gap-x-6"
      >
        {sliders.map((sl) => (
          <div key={sl.key} className="min-w-0">
            <label
              htmlFor={`${sliderId}-${sl.key}`}
              className="flex items-baseline justify-between gap-2"
            >
              <span className="text-[0.9375rem] font-medium">{sl.name}</span>
              <span className="text-caption tabular-nums text-ink-muted">
                {sl.short}
              </span>
            </label>
            <input
              id={`${sliderId}-${sl.key}`}
              type="range"
              min={0}
              max={sl.max}
              step={1}
              value={tuning[sl.key]}
              onChange={(e) =>
                setMapTuning({ ...tuning, [sl.key]: Number(e.target.value) })
              }
              aria-valuetext={sl.spoken}
              className="map-tune h-7 w-full cursor-pointer"
              style={{ "--track": sl.track } as CSSProperties}
            />
          </div>
        ))}
      </section>

      <section aria-label="Cosa mostrare" className="mt-5 flex flex-col gap-5">
        {group("La città", CITY_OPTIONS)}
        {group("Da aggiungere", EXTRA_OPTIONS)}
        {group("Mezzi pubblici", TRANSIT_OPTIONS)}
        {/* Keeps its height whether or not it has a line to say, so the panel doesn't jump as the pointer moves */}
        <p
          aria-live="polite"
          className="min-h-[2.7em] text-caption text-ink-muted"
        >
          {hint || "Tocca un colore per mostrare o togliere uno strato."}
        </p>
      </section>
    </>
  );
}

/**
 * One layer as a colour chip: a swatch of the colour it has on the map over its name, full when the layer
 * is on, a faint ghost of it when off. Pointing at it (or tabbing to it) says what it does.
 */
function Chip({
  on,
  onChange,
  onPoint,
  color,
  label,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  onPoint: (on: boolean) => void;
  color: string;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      onMouseEnter={() => onPoint(true)}
      onMouseLeave={() => onPoint(false)}
      onFocus={() => onPoint(true)}
      onBlur={() => onPoint(false)}
      style={{ "--c": color } as CSSProperties}
      className="group flex min-w-0 flex-col gap-1.5 text-left text-[0.8125rem] leading-tight text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent aria-pressed:text-ink"
    >
      <span
        aria-hidden="true"
        className="h-9 w-full rounded-lg bg-(--c) opacity-25 ring-1 ring-inset ring-white/20 transition-opacity group-hover:opacity-45 group-aria-pressed:opacity-100 group-aria-pressed:ring-black/15"
      />
      <span className="truncate">{label}</span>
    </button>
  );
}
