import { formatDate, formatTime, localDay } from "@/lib/weather/formatters";
import type { WeatherAlert as Alert } from "@/lib/weather/types";
import { Disclosure } from "./Disclosure";

function when(alert: Alert, now: number, tz: string): string {
  const sameDay = (a: number, b: number) => localDay(a, tz) === localDay(b, tz);
  const at = (ts: number) =>
    sameDay(ts, now)
      ? formatTime(ts, tz)
      : `${formatDate(ts, tz, { weekday: "short" })} ${formatTime(ts, tz)}`;
  return alert.start <= now ? `Fino a ${at(alert.end)}` : `${at(alert.start)}–${at(alert.end)}`;
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 text-alert" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round">
      <path d="M12 3.5 21.5 20h-19z" />
      <path d="M12 10v4.5" strokeLinecap="round" />
      <circle cx="12" cy="17.3" r="0.6" fill="currentColor" />
    </svg>
  );
}

/**
 * Official alerts only; never inferred. Interrupts the page hierarchy, but
 * stays restrained: a coloured edge and icon, text in ink.
 */
export function WeatherAlerts({ alerts, now, timezone }: { alerts: Alert[]; now: number; timezone: string }) {
  const active = alerts.filter((a) => a.end > now);
  if (!active.length) return null;
  return (
    <div className="flex flex-col gap-4">
      {active.map((a) => (
        <section
          key={a.id}
          aria-labelledby={`alert-${a.id}`}
          className="glass card border-alert/60!"
        >
          <p className="label flex items-center gap-2 text-ink!">
            <WarningIcon />
            Allerta meteo
          </p>
          <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
            <h2 id={`alert-${a.id}`} className="font-display text-[1.75rem] leading-tight">
              {a.event}
            </h2>
            <p className="shrink-0 text-sm tabular-nums">{when(a, now, timezone)}</p>
          </div>
          <p className="mt-1 text-sm text-ink-muted">Emessa da {a.sender}</p>
          {a.description && (
            <Disclosure more="Mostra dettagli" less="Nascondi dettagli" className="mt-3">
              <p className="mt-3 max-w-prose whitespace-pre-line text-sm leading-relaxed">{a.description}</p>
            </Disclosure>
          )}
        </section>
      ))}
    </div>
  );
}
