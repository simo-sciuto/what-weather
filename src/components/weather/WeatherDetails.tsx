import type { DetailModule } from "@/lib/weather/details";
import type { WeatherData } from "@/lib/weather/types";
import { detailContent } from "./detailContent";
import { Section } from "./Section";

/**
 * Details shown as blocks high on the page, at full size: the ones the weather
 * has made important (strong wind, high UV, poor air…), marked as alerts, and
 * air quality, which always has its place here even when the air is good.
 */
export function PromotedDetails({ data, modules }: { data: WeatherData; modules: DetailModule[] }) {
  const promoted = modules.filter((m) => m.promoted);
  if (!promoted.length) return null;
  return (
    <div className={`grid gap-8 ${promoted.length > 1 ? "xl:grid-cols-2 xl:gap-x-10" : ""}`}>
      {promoted.map((m) => {
        const c = detailContent(m.key, data);
        if (!c) return null;
        return (
          <Section key={m.key} id={`detail-${m.key}`} title={c.name} note={m.note} alert={m.alert}>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                {/* Full voice only for an alert; air that's fine keeps its place but not the big number, so the temperature leads */}
                <p
                  className={`font-display font-light tabular-nums tracking-[-0.02em] ${m.alert ? "text-6xl" : "text-4xl"}`}
                >
                  {c.value}
                </p>
                <p className="mt-3 text-base text-ink-muted">{c.note}</p>
              </div>
              <div aria-hidden="true">{c.figure?.("lg")}</div>
            </div>
            {c.more}
          </Section>
        );
      })}
    </div>
  );
}
