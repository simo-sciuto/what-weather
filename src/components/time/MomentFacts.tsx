"use client";
import { CONDITION_NAMES, WIND_LABELS } from "@/constants/labels";

import { isWet, precipNoun } from "@/lib/weather/conditions";
import { formatTemp } from "@/lib/weather/formatters";
import { useMoment } from "./TimeContext";

/**
 * Three quick facts for the moment on show: rain (how hard while it falls,
 * how likely otherwise), wind, feels-like. They follow the timeline like the
 * reading does. At the top of the weather data: the right-hand column on a
 * computer, the sheet "Meteo" on a phone, so the poster stays free of them.
 */
export function MomentFacts() {
  const { frame } = useMoment();
  const noun = precipNoun(frame.condition === "snow");
  const facts = [
    isWet(frame.condition)
      ? {
          label: frame.isNow ? `${noun} adesso` : noun,
          value:
            frame.precipitation >= 0.1
              ? `${frame.precipitation.toFixed(1)} mm/h`
              : "Debole",
        }
      : {
          label: CONDITION_NAMES.rain,
          value: `${Math.round(frame.precipProbability * 100)}%`,
        },
    {
      label: WIND_LABELS.wind,
      value: frame.windSpeed ? `${Math.round(frame.windSpeed)} km/h` : WIND_LABELS.calm,
    },
    { label: "Percepita", value: formatTemp(frame.feelsLike) },
  ];

  return (
    // Straight on the sky, between hairlines: nothing here to tap, so no panel.
    <dl className="sheet on-sky grid grid-cols-3 divide-x divide-white/15">
      {facts.map((f) => (
        <div key={f.label} className="min-w-0 px-3 first:pl-0 sm:px-4">
          <dt className="label">{f.label}</dt>
          <dd className="mt-1 font-display text-lg tabular-nums">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
