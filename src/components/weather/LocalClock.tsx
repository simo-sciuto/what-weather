"use client";

import { dateFormat, formatTime } from "@/lib/weather/formatters";
import { useEffect, useState, useSyncExternalStore } from "react";
import { subscribeOnce } from "../useHydrated";

/** Minutes east of UTC for a time zone at a given moment. */
function offsetMinutes(ts: number, timeZone: string): number {
  const parts = dateFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(new Date(ts * 1000));
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = name.match(/([+-])(\d{2}):(\d{2})/);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

/** Past this, the reading is old enough that the clock beside it should say so. */
const STALE_SECONDS = 20 * 60;

/**
 * The time at the place, always shown. The server renders it from its own
 * render time, so the markup matches; the browser then keeps it running,
 * ticking on the minute (and advancing a simulated sample time from where it
 * began). "ora locale" is added only for a place in another time zone than
 * the viewer's, which the server can't know. When the reading itself is
 * older than a few minutes, it says how old, so the clock and the data don't
 * seem to disagree.
 */
export function LocalClock({
  timezone,
  renderedAt,
  dataAt,
  shownAt,
  className = "",
  timeClassName = "text-lg font-medium tabular-nums text-ink lg:text-xl",
}: {
  timezone: string;
  renderedAt: number;
  /** When the reading on show was taken */
  dataAt: number;
  /** Another moment to show instead of the running clock (an hour picked on the timeline) */
  shownAt?: number;
  className?: string;
  timeClassName?: string;
}) {
  const abroad = useSyncExternalStore(
    subscribeOnce,
    () => offsetMinutes(renderedAt, timezone) !== -new Date(renderedAt * 1000).getTimezoneOffset(),
    () => false,
  );
  const [now, setNow] = useState(renderedAt);

  useEffect(() => {
    const mountedAt = Date.now() / 1000;
    const tick = () => setNow(renderedAt + (Date.now() / 1000 - mountedAt));
    let interval: ReturnType<typeof setInterval> | undefined;
    // First tick on the next minute boundary, then once a minute.
    const untilMinute = (60 - (renderedAt % 60)) * 1000;
    const timeout = setTimeout(() => {
      tick();
      interval = setInterval(tick, 60_000);
    }, untilMinute);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [renderedAt]);

  const age = now - dataAt;
  const at = shownAt ?? now;

  return (
    <p className={`shrink-0 text-ink-muted ${className}`}>
      <time className={`block ${timeClassName}`} dateTime={new Date(at * 1000).toISOString()}>
        {formatTime(at, timezone)}
      </time>
      {abroad ? (
        <span className="block text-xs">ora locale</span>
      ) : (
        <span className="sr-only"> ora locale</span>
      )}
      {shownAt == null && age >= STALE_SECONDS && <span className="block text-xs">dati di {formatAge(age)} fa</span>}
    </p>
  );
}

/** "25 min", "1 ora", "3 ore" */
function formatAge(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "1 ora" : `${hours} ore`;
}
