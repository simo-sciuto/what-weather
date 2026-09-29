import type { ReactNode } from "react";

/**
 * A block of content set like a poster's row (see the `sheet` utility): a
 * hairline, an uppercase title and optional note, then the content straight
 * on the sky. Blocks are container-query roots, so their content adapts to
 * the block's width rather than the page's. Without a title (a block that is
 * the whole of a chapter) there is no header: the chapter's heading names it.
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
  /** Promoted by the weather: the rule thickens in the accent, and the note leads with a marker */
  alert?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={title ? id : undefined}
      className={`sheet on-sky reveal @container flex min-w-0 flex-col ${alert ? "border-t-2! border-accent!" : ""} ${className}`}
    >
      {title && (
        <header className="mb-4 flex items-baseline justify-between gap-4">
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
