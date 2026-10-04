"use client";

import { useMoment, useView } from "./TimeContext";

/**
 * The outlook in words, for those who hear the page and not for the poster, which no longer sets sentences
 * (WTH-181): the forecast sentence for now, the day's summary in day view, a plain sentence for a scrubbed
 * hour. Read out, never shown.
 */
export function NarrativeText({ outlook, className = "" }: { outlook: string; className?: string }) {
  const { frame, isLive } = useMoment();
  const { day } = useView();
  const heading = day ? "La giornata" : isLive ? "Previsione" : `Alle ${frame.timeLabel}`;
  const text = day ? day.summary : isLive ? outlook : frame.summary;
  return (
    <section aria-labelledby="outlook-label" className={className}>
      <h2 id="outlook-label" className="sr-only">
        {heading}
      </h2>
      <p className="sr-only">{text}</p>
    </section>
  );
}
