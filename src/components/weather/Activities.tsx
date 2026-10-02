"use client";

import type { ActivityOutlook } from "@/lib/weather/activities";
import { capitalize } from "@/lib/weather/formatters";
import { useView } from "../time/TimeContext";
import { Chapter } from "./Chapter";

/** Four strokes, as many lit as the conditions are good: sage when good, butter when fair, rose when poor. */
function Meter({ level }: { level: ActivityOutlook["level"] }) {
  const lit = level >= 3 ? "bg-sage" : level === 2 ? "bg-butter" : "bg-rose";
  return (
    <span aria-hidden="true" className="flex items-end gap-1">
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className={`h-4 w-1 rounded-full ${n <= level ? lit : "bg-rule"}`}
        />
      ))}
    </span>
  );
}

/**
 * The chapter "Attività": what the next 24 hours are like for a few things
 * done outside, set like the almanac. Each row gives the conditions in a
 * word, then the best hours for it and, when something holds it back, what.
 * With a day picked in the week it turns to that day, like the reading and
 * the timeline do; a day the hourly forecast doesn't reach says so instead.
 * It reads only the view: scrubbing through the hours leaves it alone.
 */
export function Activities({
  next,
  days,
}: {
  next: ActivityOutlook[];
  days: Record<string, ActivityOutlook[]>;
}) {
  const { day } = useView();
  const activities = day ? days[day.key] : next;
  const note = day
    ? `Le condizioni di ${day.name.toLowerCase()}`
    : "Le condizioni nelle prossime 24 ore";

  return (
    <Chapter id="chapter-activities" title="Attività" note={note}>
      {activities ? (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-4 @container sm:grid-cols-4">
          {activities.map((a) => {
            const details = [a.window && `Meglio ${a.window}`, a.reason]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={a.key} className="flex min-w-0 flex-col gap-1">
                <h3 className="label">{a.name}</h3>
                <div className="flex items-end justify-between gap-2">
                  <p className="font-display text-lg leading-tight">
                    {a.verdict}
                  </p>
                  <Meter level={a.level} />
                </div>
                {details && (
                  <p className="text-xs leading-snug text-ink-muted">
                    {capitalize(details)}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="on-sky text-sm text-ink-muted">
          Così avanti non ci sono previsioni ora per ora: le attività si
          giudicano sulle ore.
        </p>
      )}
    </Chapter>
  );
}
