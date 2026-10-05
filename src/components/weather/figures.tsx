import { TIME_LABELS, ACTION_LABELS } from "@/constants/labels";
import { AQI_LABELS, POLLUTANT_NAMES } from "@/lib/weather/details";
import { POLLUTANT_INFO, POLLUTANT_SOURCES } from "@/lib/weather/pollutants";
import type { Pollutants } from "@/types/weather";

/**
 * Small data figures shared by the almanac rows and the promoted cards.
 * All decorative: the values they draw are always stated in text beside them.
 */

/** Pastel good → very poor ramp (UV and air quality): sage, butter, apricot, rose, lilac. Always paired with a written label. */
export const BAND_COLORS = ["#a5e9ca", "#f9e8a7", "#fec89c", "#feb8c1", "#d3befa"];

/** A hairline compass; the arrow flows the way the wind blows (from `deg`). */
export function Compass({ deg, className }: { deg: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <circle cx="50" cy="50" r="40" fill="none" stroke="var(--rule)" />
      {Array.from({ length: 16 }, (_, i) => i * 22.5).map((t) => (
        <line
          key={t}
          x1="50"
          y1={t % 90 === 0 ? 10 : 12}
          x2="50"
          y2={t % 90 === 0 ? 17 : 15}
          stroke={t % 90 === 0 ? "var(--ink-muted)" : "var(--rule)"}
          strokeWidth={1}
          transform={`rotate(${t} 50 50)`}
        />
      ))}
      <text x="50" y="7" textAnchor="middle" fontSize="8" fill="var(--ink-muted)">
        N
      </text>
      {/* Drawn for a north wind (top → bottom), then turned to the real direction */}
      <g transform={`rotate(${deg} 50 50)`}>
        <line x1="50" y1="22" x2="50" y2="72" stroke="var(--ink)" strokeWidth={1.5} strokeLinecap="round" />
        <path d="M44 68 L50 78 L56 68" fill="none" stroke="var(--ink)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="50" cy="22" r="3.5" fill="var(--sun)" />
      </g>
    </svg>
  );
}

/** A line through a series; at least a `minSpan` window so flat data doesn't look dramatic. */
export function Sparkline({ values, minSpan, className }: { values: number[]; minSpan: number; className?: string }) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const mid = (lo + hi) / 2;
  const span = Math.max(hi - lo, minSpan);
  const y = (v: number) => 90 - ((v - (mid - span / 2)) / span) * 80;
  const x = (i: number) => (i / (values.length - 1)) * 100;
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className={`draw overflow-visible ${className ?? ""}`}>
      <path d={d} fill="none" stroke="var(--ink-muted)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** A thin scale with a marker at `position` (0..1); banded when `bands` are given. */
export function Scale({ position, bands, className }: { position: number; bands?: string[]; className?: string }) {
  return (
    <span className={`relative flex h-1.5 gap-[2px] ${className ?? ""}`}>
      {bands ? (
        bands.map((c) => (
          <span key={c} className="h-full flex-1 first:rounded-l-full last:rounded-r-full" style={{ backgroundColor: c, opacity: 0.85 }} />
        ))
      ) : (
        <span className="h-full flex-1 rounded-full bg-white/25" />
      )}
      <span
        className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
        style={{ left: `${Math.min(Math.max(position, 0), 1) * 100}%` }}
      />
    </span>
  );
}

/** The day as an arc over the horizon, with the sun where it is now (hidden at night). */
export function SunArc({ progress, isDay, className }: { progress: number; isDay: boolean; className?: string }) {
  const p = Math.min(Math.max(progress, 0), 1);
  const theta = Math.PI * (1 - p);
  const x = 40 + 34 * Math.cos(theta);
  const y = 34 - 28 * Math.sin(theta);
  return (
    <svg viewBox="0 0 80 40" aria-hidden="true" className={className}>
      <path d="M6,34 A34,28 0 0 1 74,34" fill="none" stroke="rgb(255 255 255 / 0.3)" strokeWidth={1.5} />
      <line x1="0" y1="34" x2="80" y2="34" stroke="rgb(255 255 255 / 0.5)" strokeWidth={1} />
      {isDay && <circle cx={x} cy={y} r={4.5} fill="var(--sun)" />}
    </svg>
  );
}

/** Concentration with sensible precision: "7.4", "38". */
const concentration = (value: number) => (value < 10 ? value.toFixed(1) : String(Math.round(value)));

/**
 * One pollutant: name, a bar through its bands, and the concentration. The
 * name opens a short explanation — what it is, why it harms, the WHO
 * guideline, official sources — as a native popover: no script, dismissed
 * with Esc or a tap outside, and in the top layer so no card clips it.
 */
export function PollutantRow({ k, value, band, position }: { k: keyof Pollutants; value: number; band: number; position: number }) {
  const name = POLLUTANT_NAMES[k];
  const info = POLLUTANT_INFO[k];
  const id = `pollutant-info-${k}`;
  return (
    <li className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-x-3 py-2">
      <button
        type="button"
        popoverTarget={id}
        className="flex items-center gap-1 justify-self-start rounded text-left text-sm underline decoration-white/35 decoration-dotted underline-offset-4 hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {name.short}
        <InfoIcon className="size-3.5 text-ink-muted" />
        <span className="sr-only">: cos’è ({name.long})</span>
      </button>
      <span aria-hidden="true" className="relative h-1 rounded-full bg-rule">
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${Math.max(position * 100, 3)}%`, backgroundColor: BAND_COLORS[band - 1] }}
        />
      </span>
      <span className="text-right text-sm tabular-nums">
        {concentration(value)}
        <span className="ml-1 text-xs text-ink-muted">μg/m³</span>
        <span className="sr-only">, {AQI_LABELS[band - 1].toLowerCase()}</span>
      </span>

      <div
        id={id}
        popover="auto"
        role="dialog"
        aria-labelledby={`${id}-title`}
        className="m-auto max-h-[min(36rem,calc(100dvh-2rem))] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-white/15 bg-popover/92 p-5 text-left text-ink shadow-2xl backdrop-blur-2xl backdrop:bg-black/45 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <h3 id={`${id}-title`} className="text-lg font-semibold leading-tight">
            {name.short} <span className="font-normal text-ink-muted">· {name.long}</span>
          </h3>
          <button
            type="button"
            popoverTarget={id}
            popoverTargetAction="hide"
            aria-label={ACTION_LABELS.close}
            className="-mr-2 -mt-1 rounded-full px-2 text-xl leading-none text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            ×
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed">{info.what}</p>
        <h4 className="label mt-4">Perché fa male</h4>
        <p className="mt-1.5 text-sm leading-relaxed">{info.harm}</p>

        <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-xl bg-white/6 px-4 py-3 text-sm">
          <dt className="text-ink-muted">{TIME_LABELS.now}</dt>
          <dd className="tabular-nums">
            {concentration(value)} µg/m³ · {AQI_LABELS[band - 1].toLowerCase()}
          </dd>
          <dt className="text-ink-muted">Soglia OMS</dt>
          <dd>{info.guideline}</dd>
        </dl>
        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          Le soglie OMS sono medie su 24 ore (8 per l’ozono): il valore di un’ora è solo un’indicazione.
        </p>

        <h4 className="label mt-4">Fonti ufficiali</h4>
        <ul className="mt-1.5 flex flex-col gap-1.5 text-sm">
          {POLLUTANT_SOURCES.map((s) => (
            <li key={s.href}>
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-white/35 underline-offset-4 hover:decoration-white focus-visible:outline-2 focus-visible:outline-accent"
              >
                {s.label}
                <span aria-hidden="true"> ↗</span>
                <span className="sr-only"> (si apre in una nuova scheda)</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth={1.25}>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 7.2v4" strokeLinecap="round" />
      <circle cx="8" cy="5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
