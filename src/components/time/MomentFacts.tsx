"use client";

import { isWet } from "@/lib/weather/constants";
import { formatTemp } from "@/lib/weather/formatters";
import { useMoment } from "./TimeContext";

/**
 * Three quick facts for the moment on show: rain (how hard while it falls,
 * how likely otherwise), wind, feels-like. They follow the timeline like the
 * reading does. On a phone they sit under the reading; on a computer, at the
 * top of the right-hand column, so the pinned reading fits the screen without
 * scrolling. `on` picks which of the two places this one is.
 */
export function MomentFacts({ on }: { on: "phone" | "desktop" }) {
  const { frame } = useMoment();
  const noun = frame.condition === "snow" ? "Neve" : "Pioggia";
  const facts = [
    isWet(frame.condition)
      ? {
          label: frame.isNow ? `${noun} adesso` : noun,
          value: frame.precipitation >= 0.1 ? `${frame.precipitation.toFixed(1)} mm/h` : "Debole",
        }
      : { label: "Pioggia", value: `${Math.round(frame.precipProbability * 100)}%` },
    { label: "Vento", value: frame.windSpeed ? `${Math.round(frame.windSpeed)} km/h` : "Calma" },
    { label: "Percepita", value: formatTemp(frame.feelsLike) },
  ];

  return (
    // Straight on the sky, between hairlines: nothing here to tap, so no panel.
    <dl
      className={`on-sky grid-cols-3 divide-x divide-white/15 border-y border-white/15 py-3 ${
        on === "phone" ? "mt-6 grid lg:hidden" : "hidden lg:grid"
      }`}
    >
      {facts.map((f) => (
        <div key={f.label} className="px-4 first:pl-0">
          <dt className="label">{f.label}</dt>
          <dd className="mt-1 font-display text-lg tabular-nums">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
