/**
 * The name, set as a wordmark: "what-weather", said like "whatever". The
 * poster's grotesk in two weights: "what" light and loose as a shrug,
 * "weather" black and tight as the place's name; between them, in place of
 * the hyphen, a short butter bar sitting low like a horizon. Sized by the
 * font size it is given.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="what-weather"
      className={`inline-flex items-baseline font-poster leading-none whitespace-nowrap ${className}`}
    >
      <span className="font-light tracking-[-0.02em]">what</span>
      <span className="mx-[0.08em] inline-block h-[0.09em] w-[0.34em] translate-y-[-0.12em] rounded-full bg-accent" />
      <span className="font-extrabold tracking-[-0.05em]">weather</span>
    </span>
  );
}
