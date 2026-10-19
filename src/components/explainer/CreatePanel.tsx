"use client";

import { createHref } from "@/lib/place";
import { formatTemp, formatTime } from "@/lib/weather/formatters";
import Link from "next/link";
import { usePlace } from "../location/PlaceContext";
import { useMoment } from "../time/TimeContext";

/**
 * The CREATE station's content: a poster of the moment on show, as it will be made, and the way to make it. The hour is
 * the one in the bar and on the timeline: nothing here asks again. The poster here is a preview in the page's own type and
 * colours (the sky of the moment), standing still; the real one, with the map, is made on its own page for now (C3).
 */
export function CreatePanel({ timezone }: { timezone: string }) {
  const { place } = usePlace();
  const { frame, look, dayLabel, isLive } = useMoment();
  const [top, mid, low] = [look.palette.sky1, look.palette.sky2, look.palette.sky3];
  const href = createHref(place, isLive ? undefined : frame.time);
  const when = isLive ? "adesso" : `${dayLabel.relative ?? dayLabel.weekday} alle ${formatTime(frame.time, timezone)}`;

  return (
    <div data-create-panel className="grid gap-6 sm:grid-cols-[minmax(0,15rem)_1fr]">
      <div
        aria-hidden="true"
        className="relative mx-auto aspect-[3/4] w-full max-w-[15rem] overflow-hidden rounded-[2px] border border-white/50"
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
      </div>

      <div className="flex min-w-0 flex-col justify-center gap-4">
        <div>
          <p className="label">Il momento</p>
          <p className="mt-1 text-[1.5rem] font-semibold leading-tight tracking-[-0.02em] text-ink">
            {place.name}, {when}
          </p>
          <p className="mt-2 text-body text-ink-muted">Scegli l&apos;ora sulla traccia in basso: il poster segue il cielo di quel momento.</p>
        </div>
        <Link
          href={href}
          data-create-link
          className="inline-flex h-11 items-center self-start rounded-[2px] bg-accent px-5 text-[0.9375rem] font-extrabold text-[#101428] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Crea il poster
        </Link>
        <p className="text-caption text-ink-muted">Poi lo conservi, e lo condividi quando vuoi.</p>
      </div>
    </div>
  );
}
