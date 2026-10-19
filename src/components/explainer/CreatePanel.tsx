"use client";

import { createHref } from "@/lib/place";
import { formatTemp, formatTime } from "@/lib/weather/formatters";
import Link from "next/link";
import { usePlace } from "../location/PlaceContext";
import { useMoment } from "../time/TimeContext";

/**
 * CREATE on the home page: a poster of the moment on show, as it will be made, and the way to make it. The hour is the
 * one chosen on the timeline above: nothing here asks again. The poster here is a preview in the page's own type and
 * colours (the sky of the moment); the real one, with the map, is made on its own page.
 */
export function CreatePanel({ timezone }: { timezone: string }) {
  const { place } = usePlace();
  const { frame, look, dayLabel, isLive } = useMoment();
  const [top, mid, low] = [look.palette.sky1, look.palette.sky2, look.palette.sky3];
  const href = createHref(place, isLive ? undefined : frame.time);
  const when = isLive ? "adesso" : `${dayLabel.relative ?? dayLabel.weekday} alle ${formatTime(frame.time, timezone)}`;

  return (
    <section data-create-panel aria-label="Creo un record" className="only-crea data-col relative flex flex-col gap-4 pb-6 lg:col-span-7 lg:col-start-6 lg:row-start-3 lg:pb-10 lg:pt-6 xl:col-span-6 xl:col-start-7">
      <div className="grid gap-5 rounded-3xl border border-white/15 bg-white/6 p-4 shadow-[inset_0_0.5px_0_rgb(255_255_255/0.35)] backdrop-blur-[6px] sm:grid-cols-[minmax(0,15rem)_1fr] sm:p-5">
        <div
          aria-hidden="true"
          className="relative mx-auto aspect-[3/4] w-full max-w-[15rem] overflow-hidden rounded-md border border-white/30 shadow-[0_24px_60px_rgb(0_0_0/0.4)]"
          style={{ background: `linear-gradient(180deg, ${top} 0%, ${mid} 55%, ${low} 100%)` }}
        >
          <div className="absolute inset-x-0 top-0 p-4">
            <p className="text-[0.625rem] uppercase tracking-[0.16em] text-ink-muted">Luogo</p>
            <p className="mt-2 truncate text-[1.75rem] font-extrabold leading-none tracking-[-0.04em] text-ink">{place.name}</p>
          </div>
          <p className="absolute inset-x-4 top-[38%] font-display text-[5.5rem] font-bold leading-none tracking-[-0.04em] text-accent">{formatTemp(frame.temp)}</p>
          <div className="absolute inset-x-4 bottom-4 border-t border-white/60 pt-2">
            <div className="flex justify-between text-ink">
              <span>
                <span className="block text-[0.5625rem] uppercase tracking-[0.16em] text-ink-muted">Giorno</span>
                <span className="text-[0.75rem]">{dayLabel.relative ?? dayLabel.weekday}</span>
              </span>
              <span>
                <span className="block text-[0.5625rem] uppercase tracking-[0.16em] text-ink-muted">Ora</span>
                <span className="text-[0.75rem] tabular-nums">{formatTime(frame.time, timezone)}</span>
              </span>
            </div>
          </div>
          <span className="pointer-events-none absolute -inset-y-4 -left-1/2 w-1/3 -skew-x-12 bg-white/25 blur-[2px] [animation:poster-shine_4.5s_ease-in-out_infinite]" />
        </div>

        <div className="flex min-w-0 flex-col justify-center gap-4">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-ink-muted">Il momento</p>
            <p className="mt-1 text-[1.5rem] font-semibold leading-tight tracking-[-0.02em] text-ink">
              {place.name}, {when}
            </p>
            <p className="mt-2 text-body text-ink-muted">Scegli l&apos;ora sulla timeline qui sopra: il poster segue il cielo di quel momento.</p>
          </div>
          <Link
            href={href}
            data-create-link
            className="group inline-flex items-center gap-3 self-start rounded-full bg-accent px-6 py-3 font-display text-[1.0625rem] font-semibold text-[#101428] transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Crea il poster
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
          <p className="text-caption text-ink-muted">Poi lo conservi, e lo condividi quando vuoi.</p>
        </div>
      </div>
    </section>
  );
}
