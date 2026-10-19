"use client";

import { trackOnce } from "@/lib/analytics/analytics";
import { useId, useState, type ReactNode } from "react";

/**
 * The deepest level of the page (ADR-018), closed until asked for: a heading that is also the button that opens it
 * (the disclosure pattern). What is inside is not mounted while it is closed, so the rain map and its animation cost
 * nothing to a reader who never opens it.
 */
export function DetailsDisclosure({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  return (
    <div className="flex flex-col gap-2.5">
      <section className="sheet on-sky">
        <h2 className="label">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panel}
            onClick={() => {
              if (!open) trackOnce("explore", { source: "details" });
              setOpen((o) => !o);
            }}
            className="flex w-full items-baseline justify-between gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            <span className="text-ink">{title}</span>
            <span className="flex items-baseline gap-3 text-right font-medium normal-case tracking-normal">
              {note}
              <span aria-hidden="true" className="text-ink">
                {open ? "−" : "+"}
              </span>
            </span>
          </button>
        </h2>
      </section>
      <div id={panel} className="contents">
        {open && children}
      </div>
    </div>
  );
}
