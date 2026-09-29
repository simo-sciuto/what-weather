import type { PrecipOutlook } from "@/lib/weather/precipitation";
import { Section } from "./Section";

/**
 * Contextual precipitation timeline. Only rendered when something is coming;
 * the page promotes it above the hourly forecast when it is imminent.
 */
export function PrecipitationTimeline({ outlook, className }: { outlook: PrecipOutlook; className?: string }) {
  const { bars, ticks, measure, noun, headline, facts, guides } = outlook;
  const minutes = bars.length > 1 && bars[1].time - bars[0].time <= 60;
  const dense = bars.length > 24;

  return (
    <Section
      id="precipitation"
      title={noun}
      note={measure === "probability" ? "Probabilità di precipitazioni" : minutes ? "Prossima ora · intensità" : "Prossime ore · intensità"}
      className={className}
    >
      <p className="font-display text-[1.5rem] leading-tight lg:text-[1.625rem]">
        {headline}
      </p>

      {facts && (
        <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-rule pt-4">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="label">{f.label}</dt>
              <dd className="mt-1 text-base tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <figure className="mt-6">
        <div className="relative h-24 border-b border-rule">
          {/* Faint guide at the top of the scale: heavy rain or certainty */}
          <div aria-hidden="true" className="absolute inset-x-0 top-0 border-t border-rule/60" />
          {/* Where the rain turns moderate, then heavy */}
          {guides?.map((g) => (
            <div key={g.label} aria-hidden="true" className="absolute inset-x-0 border-t border-dashed border-white/20" style={{ bottom: `${g.at * 100}%` }}>
              <span className="absolute right-0 -top-4 text-[0.625rem] text-ink-muted">{g.label}</span>
            </div>
          ))}
          <div
            className={`absolute inset-0 flex items-end ${dense ? "gap-[2px]" : "gap-1 sm:gap-2"}`}
            role="img"
            aria-label={`${headline}. ${measure === "intensity" ? `Le barre mostrano l’intensità ${minutes ? "minuto per minuto" : "ogni quarto d’ora"}.` : "Le barre mostrano la probabilità di precipitazioni."}`}
          >
            {bars.map((b) => (
              <div key={b.time} className="flex h-full flex-1 items-end justify-center" title={b.label}>
                <div
                  className="w-full max-w-6 rounded-t-[4px] bg-precip"
                  // The less likely, the fainter
                  style={{
                    height: `${Math.max(b.value * 100, b.value > 0 ? 3 : 0)}%`,
                    opacity: b.chance == null ? 1 : 0.35 + 0.65 * b.chance,
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div aria-hidden="true" className="relative mt-2 h-4 text-[0.6875rem] tabular-nums text-ink-muted">
          {ticks.map((t) => (
            <span
              key={t.label}
              className="absolute whitespace-nowrap"
              // Labels near either edge are pinned to it instead of overflowing.
              style={
                t.at >= 0.92
                  ? { right: 0 }
                  : t.at <= 0.08
                    ? { left: 0 }
                    : { left: `${t.at * 100}%`, transform: "translateX(-50%)" }
              }
            >
              {t.label}
            </span>
          ))}
        </div>

        {!dense && (
          <figcaption className="sr-only">
            <ul>
              {bars.map((b) => (
                <li key={b.time}>{b.label}</li>
              ))}
            </ul>
          </figcaption>
        )}
      </figure>
    </Section>
  );
}
