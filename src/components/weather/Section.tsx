import type { ReactNode } from "react";

/**
 * A card: uppercase title, optional note, content. Cards are container-query
 * roots, so their content adapts to the card's width rather than the page's.
 * Without a title (a card that is the whole of a chapter) there is no header:
 * the chapter's heading already names it.
 */
export function Section({
  id,
  title,
  note,
  alert = false,
  className = "",
  children,
}: {
  id?: string;
  title?: string;
  note?: string;
  /** Promoted by the weather: accent outline, and the note leads with a marker */
  alert?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={title ? id : undefined}
      className={`glass card reveal @container flex min-w-0 flex-col ${alert ? "border-accent/70!" : ""} ${className}`}
    >
      {title && (
        <header className="mb-5 flex items-baseline justify-between gap-4">
          <h2 id={id} className="label text-ink!">
            {title}
          </h2>
          {note && (
            <p className={`label flex items-center gap-1.5 text-right ${alert ? "text-ink!" : ""}`}>
              {alert && <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />}
              {note}
            </p>
          )}
        </header>
      )}
      {children}
    </section>
  );
}
