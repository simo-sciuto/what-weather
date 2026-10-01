"use client";

import { placeParts } from "@/lib/weather/formatters";
import type { MapOption } from "@/lib/map-options";
import type { SkyPalette } from "@/lib/weather/palette";
import { sunPosition, type SunPosition } from "@/lib/weather/sun-position";
import { useEffect, useId, useRef, useState } from "react";
import { usePlace } from "../location/PlaceContext";
import { useMoment } from "../time/TimeContext";
import { useMapOptions, useMapPalette } from "../weather/MapControls";
import { useMap } from "../weather/MapContext";
import { currentView } from "../weather/map-view";
import { POSTER_FORMATS, renderPoster, type PosterFormat, type PosterInput } from "./render-poster";

/** The sky, the day, the map's extra layers, the sun and how close and how tipped the map is, as the poster is drawn: taken when the dialog opens. */
type Snapshot = { palette: SkyPalette; dayKey: PosterInput["dayKey"]; options: MapOption[]; sun: SunPosition; view: { zoom: number; pitch: number } };

type Drawn = { status: "drawing" } | { status: "done"; url: string; blob: Blob } | { status: "error" };

const FORMATS = Object.keys(POSTER_FORMATS) as PosterFormat[];

function revokeAll(drawn: Partial<Record<PosterFormat, Drawn>>) {
  for (const d of Object.values(drawn)) if (d?.status === "done") URL.revokeObjectURL(d.url);
}

/** A file name without accents or spaces: "what-weather-reykjavik-stampa-a.png". */
function fileName(place: string, format: PosterFormat) {
  const slug = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  return `what-weather-${slug(place)}-${slug(POSTER_FORMATS[format].label)}.png`;
}

/**
 * "Crea poster", under the reading: a dialog that draws the place as a Swiss
 * poster (the map in the colours of the moment on show; its name, region and
 * country; its coordinates; the colours) in three formats, with a preview, a download and, where the
 * device can, a share. The colours are those of the moment when it opens, so
 * the clock ticking on doesn't redraw it. Without Mapbox there is no map, and
 * so no poster.
 */
export function PosterButton({ className = "" }: { className?: string }) {
  const { place } = usePlace();
  const { token, loadMapbox } = useMap();
  const { frame } = useMoment();
  // The map's lines as the viewer turned them: the poster is drawn as the page is
  const palette = useMapPalette();
  const options = useMapOptions();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [format, setFormat] = useState<PosterFormat>("print");
  const [drawn, setDrawn] = useState<Partial<Record<PosterFormat, Drawn>>>({});
  const [canShare, setCanShare] = useState(false);

  const current = drawn[format];
  // Object URLs still held when the page leaves are given back.
  const held = useRef(drawn);
  useEffect(() => {
    held.current = drawn;
  }, [drawn]);
  useEffect(() => () => revokeAll(held.current), []);

  if (!token) return null;

  /** Draws one format in the sky and day given; each is drawn once per opening, when first shown. */
  function draw(f: PosterFormat, { palette, dayKey, options, sun, view }: Snapshot) {
    if (!token) return;
    setDrawn((d) => ({ ...d, [f]: { status: "drawing" } }));
    const where = { name: place.name, ...placeParts(place), lat: place.lat, lon: place.lon };
    renderPoster({ format: f, place: where, dayKey, palette, options, sun, view, token, loadMapbox })
      .then((blob) => setDrawn((d) => ({ ...d, [f]: { status: "done", url: URL.createObjectURL(blob), blob } })))
      .catch(() => setDrawn((d) => ({ ...d, [f]: { status: "error" } })));
  }

  function open() {
    const taken: Snapshot = { palette, dayKey: frame.dayKey, options, sun: sunPosition(frame.time, place.lat, place.lon), view: currentView() };
    setSnapshot(taken);
    setDrawn({});
    setCanShare(typeof navigator.canShare === "function");
    dialog.current?.showModal();
    draw(format, taken);
  }

  function pick(f: PosterFormat) {
    setFormat(f);
    if (!drawn[f] && snapshot) draw(f, snapshot);
  }

  function close() {
    dialog.current?.close();
  }

  function onClose() {
    revokeAll(drawn);
    setSnapshot(null);
    setDrawn({});
  }

  async function share() {
    if (current?.status !== "done") return;
    const file = new File([current.blob], fileName(place.name, format), { type: "image/png" });
    if (!navigator.canShare?.({ files: [file] })) return;
    await navigator.share({ files: [file], title: `${place.name} · what-weather` }).catch(() => undefined);
  }

  const { width, height } = POSTER_FORMATS[format];
  const action =
    "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <>
      <button
        type="button"
        onClick={open}
        className={`inline-flex items-center gap-2 rounded-sm text-caption text-ink-muted underline decoration-white/35 underline-offset-4 hover:text-ink hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${className}`}
      >
        <PosterIcon className="size-4" />
        Crea poster
      </button>

      <dialog
        ref={dialog}
        onClose={onClose}
        aria-labelledby={titleId}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-white/15 bg-popover/95 p-5 text-left text-ink shadow-2xl backdrop-blur-2xl backdrop:bg-black/55 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="font-display text-2xl font-semibold leading-tight tracking-[-0.02em]">
              Poster di {place.name}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">La città nei colori del cielo di questo momento, come la vedi nella mappa.</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Chiudi"
            className="-mr-2 -mt-1 rounded-full px-2 text-2xl leading-none text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            ×
          </button>
        </div>

        <div role="group" aria-label="Formato" className="mt-5 grid grid-cols-3 gap-1 rounded-full border border-white/15 p-1">
          {FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={f === format}
              onClick={() => pick(f)}
              className="rounded-full px-2 py-2 text-sm transition-colors hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-accent aria-pressed:bg-white/14 aria-pressed:font-medium"
            >
              {POSTER_FORMATS[f].label}
            </button>
          ))}
        </div>

        {/* The preview keeps the format's shape while it draws, so nothing jumps */}
        <div className="mt-5 flex justify-center">
          <div
            className="relative w-full max-w-full overflow-hidden rounded-md bg-white/6"
            style={{ aspectRatio: `${width} / ${height}`, maxHeight: "min(52dvh, 30rem)", width: "auto", height: "min(52dvh, 30rem)" }}
          >
            {current?.status === "done" ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local blob, nothing for next/image to optimise
              <img src={current.url} alt={`Poster di ${place.name}, formato ${POSTER_FORMATS[format].label}`} className="size-full object-contain" />
            ) : (
              <div className="skeleton absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-ink-muted">
                <p role="status">
                  {current?.status === "error"
                    ? "Non sono riuscito a disegnare il poster. Riprova tra poco."
                    : "Sto disegnando il poster…"}
                </p>
              </div>
            )}
          </div>
        </div>

        <p className="mt-3 text-center text-xs tabular-nums text-ink-muted">
          PNG · {width} × {height} px
        </p>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {canShare && current?.status === "done" && (
            <button type="button" onClick={share} className={`${action} border border-white/20 hover:bg-white/8`}>
              Condividi
            </button>
          )}
          {current?.status === "done" ? (
            <a href={current.url} download={fileName(place.name, format)} className={`${action} bg-accent text-[#0c0f25] hover:bg-accent/85`}>
              Scarica
            </a>
          ) : current?.status === "error" ? (
            <button
              type="button"
              onClick={() => snapshot && draw(format, snapshot)}
              className={`${action} bg-accent text-[#0c0f25] hover:bg-accent/85`}
            >
              Riprova
            </button>
          ) : (
            <span aria-disabled="true" className={`${action} bg-accent/40 text-[#0c0f25]/70`}>
              Scarica
            </span>
          )}
        </div>
      </dialog>
    </>
  );
}

function PosterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round">
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <path d="M8 15.5h8M8 18h5" strokeLinecap="round" />
      <path d="m7.5 11 3-3 2.5 2.5L16.5 7" strokeLinecap="round" />
    </svg>
  );
}
