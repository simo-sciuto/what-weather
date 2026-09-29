import type { ReactNode } from "react";

/** A native <details> with a quiet chevron and an open/closed label ("More" / "Less"). */
export function Disclosure({
  more,
  less,
  className = "",
  children,
}: {
  more: string;
  less: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details className={`group ${className}`}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="transition-transform group-open:rotate-90">
          ›
        </span>
        <span className="group-open:hidden">{more}</span>
        <span className="hidden group-open:inline">{less}</span>
      </summary>
      {children}
    </details>
  );
}
