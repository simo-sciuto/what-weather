"use client";

import { MomentFacts } from "./MomentFacts";
import { NarrativeText } from "./NarrativeText";

/**
 * The poster's foot, its second voice: a hairline, then the outlook in words,
 * large, on the grid's last four columns, labelled in small print on the first
 * two (on a phone, the label over the sentence, which takes the full width);
 * then (on a phone) three quick facts. On a computer those sit in the right
 * column. Room is left at the bottom for the map's logo.
 */
export function HeroReading({ outlook }: { outlook: string }) {
  return (
    <div className="lg:pb-8">
      <div className="grid grid-cols-6 gap-x-4 gap-y-1 border-t border-white/30 pt-3">
        <p aria-hidden="true" className="col-span-6 text-caption text-ink-muted lg:col-span-2">
          Previsione
        </p>
        <NarrativeText outlook={outlook} className="col-span-6 min-w-0 lg:col-span-4 lg:col-start-3" />
      </div>
      <MomentFacts on="phone" />
    </div>
  );
}
