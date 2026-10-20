"use client";

import { createHref } from "@/lib/place";
import { formatTime } from "@/lib/weather/formatters";
import { TrackOnMount } from "../analytics/TrackOnMount";
import { KEEP_TITLE_ID, KeepPanel } from "../keep/KeepPanel";
import { KeepButton } from "../keep/KeepButton";
import { usePlace } from "../location/PlaceContext";
import { PosterButton } from "../poster/PosterButton";
import { useMoment } from "../time/TimeContext";
import { Wordmark } from "../Wordmark";
import Link from "next/link";

/**
 * Crea (ADR-029), as it was the page `/crea` until now and moved into the one page (D3): the place and the moment on
 * show, the way to make the poster of them, and under it "I tuoi poster", what is kept on this device. The place and
 * the moment are the page's own (the providers above), not loaded again: the moment is the one the address named, or
 * the one chosen on the curve of the hours, or Adesso. An address whose `t` the forecast does not hold is said so,
 * and no poster is offered for it, never one of another hour in its place (WTH-236). The poster's dialog and its
 * second click ("Crea poster", then the dialog's own draw) are as they were; D5 makes the poster appear at once.
 */
export function CreaSection({
  timezone,
  mapbox,
  unavailable,
}: {
  timezone: string;
  /** Whether there is a Mapbox token: without a map there is no poster */
  mapbox: boolean;
  /** The address asked for an hour the forecast does not hold */
  unavailable?: { asked: string | null };
}) {
  const { place } = usePlace();
  const { frame, dayLabel, isLive } = useMoment();
  // The unavailable hour is told while the page is on Adesso; once somebody has chosen an hour that exists it no longer applies
  const missing = unavailable !== undefined && isLive;
  const when = `${dayLabel.weekday} ${dayLabel.date}, ${frame.overview ? "tutto il giorno" : formatTime(frame.time, timezone)}`;

  return (
    <div className="mx-auto flex min-h-full max-w-[88rem] flex-col gap-12 px-5 pb-[calc(var(--dock-room)+2rem)] pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 lg:px-12">
      <TrackOnMount event="create_open" />
      <header className="flex items-center justify-between gap-5 pt-4">
        <Link href="/" className="on-sky rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
          <Wordmark className="text-[1.375rem]" />
        </Link>
      </header>
      <section aria-labelledby="crea-title" className="flex flex-col gap-5 lg:max-w-[40rem]">
        <p className="on-sky text-sm uppercase tracking-[0.12em]">Crea</p>
        <h1
          id="crea-title"
          data-section-title="crea"
          tabIndex={-1}
          className="on-sky font-display text-[clamp(2.5rem,9vw,5.5rem)] font-semibold leading-[0.95] tracking-[-0.03em] outline-none"
        >
          {place.name}
        </h1>
        <div>
          <KeepButton />
        </div>
        {!missing && (
          <p className="on-sky text-sm">
            {isLive ? "Adesso" : "Previsione"} · {when}
          </p>
        )}
        <p className="on-sky max-w-[34rem] text-base">
          {isLive
            ? "Il cielo e la mappa di questo luogo, in questo momento, come un poster."
            : "Il cielo previsto per questo luogo a quel momento, come un poster."}
        </p>
        {missing ? (
          <div className="flex flex-col gap-3">
            <p role="status" className="on-sky max-w-[34rem] text-sm">
              Il momento scelto non è più disponibile: il meteo cambia e l’ora può essere passata. Scegline un altro in Meteo,
              oppure crea il poster per il momento attuale.
            </p>
            <Link
              href={createHref(place)}
              className="on-sky text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              Crea per il momento attuale
            </Link>
          </div>
        ) : mapbox ? (
          <PosterButton />
        ) : (
          <p className="on-sky text-sm">Senza una mappa non si può creare il poster.</p>
        )}
      </section>
      <section aria-labelledby={KEEP_TITLE_ID} className="flex flex-col gap-4 border-t border-white/50 pt-3 lg:max-w-[40rem]">
        <h2 id={KEEP_TITLE_ID} tabIndex={-1} className="label text-ink! outline-none">
          I tuoi poster
        </h2>
        <KeepPanel />
      </section>
    </div>
  );
}
