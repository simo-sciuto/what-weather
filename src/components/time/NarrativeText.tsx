"use client";

import { useMoment, useView } from "./TimeContext";

/**
 * The outlook in words, beside the temperature it explains: the forecast
 * sentence for now, the day's summary in day view, a plain sentence for a
 * scrubbed hour.
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
      <p className="rise-in-late w-full max-w-xl font-poster text-xl leading-snug font-light tracking-[-0.01em] text-pretty lg:text-[2rem] lg:leading-[1.15] lg:font-normal lg:tracking-[-0.02em]">{text}</p>
    </section>
  );
}
