"use client";

import { useMeteoParts, type Part } from "./MeteoParts";

const TITLES: { part: Part; label: string }[] = [
  { part: "tempo", label: "Tempo" },
  { part: "territorio", label: "Territorio" },
];

/**
 * The two titles of the Meteo section, Tempo and Territorio, set large as type and not as tabs or pills: the one being
 * read has a 3 px line of the accent under it. Buttons that lead to a part of the page (a gentle scroll, at once for
 * those who asked for less motion); they are not links, as a part has no address of its own. Without Territorio there is
 * only "Tempo". `band` is the small version in the Testata's band on a phone.
 */
export function PartsNav({ size = "page" }: { size?: "page" | "band" }) {
  const { active, hasTerritory, go } = useMeteoParts();
  const shown = TITLES.filter((t) => t.part === "tempo" || hasTerritory);
  const sizes =
    size === "band"
      ? "h-[3.5rem] px-2 text-[1rem] tracking-[-0.01em]"
      : "min-h-12 pr-1 text-[clamp(1.75rem,5vw,2.25rem)] tracking-[-0.03em] sm:pr-3";
  return (
    <nav aria-label={size === "band" ? "Parti di Meteo, in alto" : "Parti di Meteo"} data-parts-nav={size} className="flex items-end gap-5 sm:gap-8">
      {shown.map(({ part, label }) => (
        <button
          key={part}
          type="button"
          aria-current={active === part ? "true" : undefined}
          onClick={() => go(part)}
          className={`on-sky relative flex items-center border-b-[3px] border-transparent font-extrabold leading-none text-ink opacity-70 transition-opacity aria-[current=true]:border-accent aria-[current=true]:opacity-100 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${sizes}`}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
