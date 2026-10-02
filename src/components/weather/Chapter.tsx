import type { ReactNode } from "react";

/**
 * A chapter of the page (Prossime ore, Settimana, Dettagli), opened like the
 * poster's rows: a hairline, then the title and a note beside it on how to
 * read or use what follows. It scrolls with its chapter, straight on the sky.
 */
export function Chapter({
  id,
  title,
  note,
  bare = false,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  /** Its content is tiles of its own: the chapter is only their heading, for screen readers */
  bare?: boolean;
  children: ReactNode;
}) {
  if (bare)
    return (
      <section aria-labelledby={id} className="flex flex-col">
        <h2 id={id} className="sr-only">
          {title}
          {note && `, ${note}`}
        </h2>
        {children}
      </section>
    );
  return (
    <section aria-labelledby={id} className="sheet on-sky flex flex-col gap-3">
      <h2 id={id} className="label flex items-baseline justify-between gap-3">
        <span className="text-ink">{title}</span>
        {note && (
          <span className="text-right font-medium normal-case tracking-normal">
            {note}
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}
