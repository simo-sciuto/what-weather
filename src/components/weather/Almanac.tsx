import type { DetailModule } from "@/lib/weather/details";
import type { WeatherData } from "@/lib/weather/types";
import { detailContent, type DetailContent } from "./detailContent";

/**
 * The quiet details, set as a typographic list rather than a wall of cards.
 * Whatever the weather has promoted is shown as a card instead and left out here.
 */
export function Almanac({ data, modules }: { data: WeatherData; modules: DetailModule[] }) {
  const rows = modules
    .filter((m) => !m.promoted)
    .map((m) => ({ key: m.key, content: detailContent(m.key, data) }))
    .filter((r): r is { key: DetailModule["key"]; content: DetailContent } => r.content !== null);

  return (
    // Two columns where the chapter is wide enough, so short rows don't leave a band of empty sky beside them
    // (a container query can't read its own element, so the list sits in one)
    <div className="@container">
      <ul className="on-sky reveal grid border-t border-rule @xl:grid-cols-2 @xl:gap-x-10">
        {rows.map(({ key, content: c }) => (
          <li key={key} className="@container border-b border-rule">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-4 @md:grid-cols-[8rem_minmax(0,1fr)_auto]">
              <h3 className="label col-span-full @md:col-span-1">{c.name}</h3>
              <div className="min-w-0">
                <p className="text-[1.625rem] font-light tabular-nums tracking-[-0.01em]">{c.value}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{c.note}</p>
              </div>
              <div aria-hidden="true" className="flex justify-end">
                {c.figure?.("sm")}
              </div>
              {c.more && <div className="col-span-full">{c.more}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
