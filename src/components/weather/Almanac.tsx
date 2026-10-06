import type { DetailModule } from "@/lib/weather/details";
import type { WeatherData } from "@/types/weather";
import { detailContent, type DetailContent } from "./detailContent";

/**
 * The quiet details, as tiles two to a row: a label, the reading large, a figure beside it, a line of
 * context at the foot.
 * Whatever the weather has promoted is shown as a card instead and left out here.
 */
export function Almanac({
  data,
  modules,
}: {
  data: WeatherData;
  modules: DetailModule[];
}) {
  const rows = modules
    .filter((m) => !m.promoted)
    .map((m) => ({ key: m.key, content: detailContent(m.key, data) }))
    .filter(
      (r): r is { key: DetailModule["key"]; content: DetailContent } =>
        r.content !== null,
    );

  return (
    // Tiles two to a row (three where the column is wide); one with more to show takes the whole row
    <div className="@container">
      <ul className="on-sky reveal grid grid-cols-2 gap-2.5 @2xl:grid-cols-3">
        {rows.map(({ key, content: c }) => (
          <li
            key={key}
            className={`sheet flex min-w-0 flex-col ${c.more ? "col-span-full" : ""}`}
          >
            <h3 className="label">{c.name}</h3>
            <p className="mt-2 font-display text-[1.75rem] font-light leading-none tabular-nums tracking-[-0.02em]">
              {c.value}
            </p>
            {/* The figure under the reading, held to the tile's width */}
            {c.figure && (
              <div
                aria-hidden="true"
                className="mt-3 max-w-full overflow-hidden [&_svg]:max-w-full"
              >
                {c.figure("sm")}
              </div>
            )}
            <p className="mt-auto pt-3 text-[0.8125rem] leading-snug text-ink-muted">
              {c.note}
            </p>
            {c.more && <div className="mt-2">{c.more}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
