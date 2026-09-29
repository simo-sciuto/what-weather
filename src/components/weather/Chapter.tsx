import type { ReactNode } from "react";

/**
 * A chapter of the page (Prossime ore, Settimana, Dettagli), opened like the
 * poster's rows: a hairline, then the title and a note beside it on how to
 * read or use what follows. It scrolls with its chapter, straight on the sky.
 */
export function Chapter({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="chapter-title on-sky border-t border-white/30 pt-3">
        {title}
        {note && <span className="ml-3 text-sm font-normal tracking-normal text-ink-muted">{note}</span>}
      </h2>
      {children}
    </section>
  );
}
