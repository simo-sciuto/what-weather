import { THRESHOLDS, isWet } from "./constants";
import { formatTime } from "./formatters";
import type { Condition, WeatherData } from "@/types/weather";

/**
 * Near-term precipitation, summarized for the timeline module. Uses the finest
 * data the provider offers — minutes, then 15-minute steps, then the hourly
 * (or 3-hourly) forecast — and returns null when nothing meaningful is coming.
 */

export type PrecipBar = {
  time: number;
  /** Bar height, 0..1 */
  value: number;
  /** How likely, 0..1, when the height is the intensity (drawn as the bar's strength); absent otherwise */
  chance?: number;
  /** Plain-language description for tooltips and screen readers */
  label: string;
};

export type PrecipOutlook = {
  noun: "Pioggia" | "Neve";
  headline: string;
  /** What the bar height encodes */
  measure: "intensity" | "probability";
  bars: PrecipBar[];
  /** Axis labels, positioned 0..1 along the timeline (bar centres) */
  ticks: { at: number; label: string }[];
  /** Precipitation now or within two hours: promote the module */
  urgent: boolean;
  /** Key figures of the spell (total, peak, chance), when the forecast gives amounts */
  facts?: { label: string; value: string }[];
  /** Where the intensity bands begin on the bar scale (0..1), for guide lines */
  guides?: { at: number; label: string }[];
};

/** Bar height for a rate: the square root keeps light rain visible next to a heavy burst; 8 mm/h fills the scale. */
const rateHeight = (mmh: number) => Math.min(1, Math.sqrt(mmh / 8));
/** The boundaries of the intensity words, on the bar scale */
const INTENSITY_GUIDES = [
  { at: rateHeight(2.5), label: "moderata" },
  { at: rateHeight(7.6), label: "forte" },
];
const mm = (v: number) => `${v < 10 ? v.toFixed(1).replace(".", ",") : Math.round(v)} mm`;

type Step = {
  time: number;
  condition: Condition;
  precipProbability: number;
  precipitation: number;
};

const URGENT_WITHIN = 2 * 3600;

const likely = (s: Step) =>
  s.precipProbability >= THRESHOLDS.precipProbability &&
  (isWet(s.condition) || s.precipitation >= THRESHOLDS.minutePrecip);

/** mm/h → words, using the conventional rain-rate bands (feminine, like both nouns). */
function intensityWord(mmh: number): string {
  if (mmh < 2.5) return "debole";
  if (mmh < 7.6) return "moderata";
  return "forte";
}

function nounFor(d: WeatherData, steps: Step[]): PrecipOutlook["noun"] {
  return d.current.condition === "snow" || steps.some((s) => likely(s) && s.condition === "snow")
    ? "Neve"
    : "Pioggia";
}

function fromMinutes(d: WeatherData): PrecipOutlook | null {
  const minutes = d.minutely;
  const wet = (p: number) => p >= THRESHOLDS.minutePrecip;
  if (!minutes?.length || !minutes.some((m) => wet(m.precipitation))) return null;

  const noun = d.current.condition === "snow" ? "Neve" : "Pioggia";
  const tz = d.timezone;
  const at = (i: number) => formatTime(minutes[i].time, tz);
  const word = (i: number) => intensityWord(minutes[i].precipitation);

  // The outlook already says "tra N min"; here we add clock times and how intensity develops.
  const wetNow = wet(minutes[0].precipitation);
  const start = wetNow ? 0 : minutes.findIndex((m) => wet(m.precipitation));
  const stop = minutes.findIndex((m, i) => i > start && !wet(m.precipitation));
  const spell = minutes.slice(start, stop === -1 ? undefined : stop);
  const peak = start + spell.reduce((best, m, i) => (m.precipitation > spell[best].precipitation ? i : best), 0);
  const first = word(start);
  const strongest = word(peak);
  const builds = strongest !== first;

  // Or it weakens: the first minute after the start whose band drops.
  const ease = builds ? -1 : spell.findIndex((_, i) => word(start + i) !== first);
  const eases = ease > 0;

  let headline = wetNow ? `${noun} ${first} in corso` : `${noun} ${first} dalle ${at(start)}`;
  if (builds) headline += `, ${strongest} verso le ${at(peak)}`;
  if (eases) headline += `, poi ${word(start + ease)} dalle ${at(start + ease)}`;
  if (stop !== -1) headline += `${builds || eases ? "," : ""} fino alle ${at(stop)} circa`;
  else if (!builds && !eases && wetNow) headline += " per la prossima ora";

  return {
    noun,
    headline,
    measure: "intensity",
    // Square root keeps light rain visible next to a heavy burst; 8 mm/h fills the scale.
    bars: minutes.map((m) => ({
      time: m.time,
      value: rateHeight(m.precipitation),
      label: wet(m.precipitation)
        ? `${formatTime(m.time, d.timezone)}: ${noun.toLowerCase()} ${intensityWord(m.precipitation)}`
        : `${formatTime(m.time, d.timezone)}: asciutto`,
    })),
    ticks: [0, 15, 30, 45, 60].map((m) => ({ at: m / 60, label: m === 0 ? "Adesso" : `${m} min` })),
    urgent: true,
    guides: INTENSITY_GUIDES,
  };
}

function fromSteps(d: WeatherData, all: Step[], horizonHours: number): PrecipOutlook | null {
  const now = d.current.time;
  const steps = all.filter((s) => s.time >= now - 900 && s.time <= now + horizonHours * 3600);
  const start = steps.findIndex(likely);
  if (start === -1) return null;

  const tz = d.timezone;
  const noun = nounFor(d, steps);
  const end = steps.findIndex((s, i) => i > start && !likely(s));
  const from = formatTime(steps[start].time, tz);
  const wetNow = isWet(d.current.condition) && steps[start].time - now < 3600;

  let headline: string;
  if (wetNow) {
    headline = end === -1 ? `${noun} anche nelle prossime ore` : `${noun} in esaurimento verso le ${formatTime(steps[end].time, tz)}`;
  } else {
    headline = end === -1 ? `${noun} probabile dalle ${from}` : `${noun} prevista tra le ${from} e le ${formatTime(steps[end].time, tz)}`;
  }

  const urgent = wetNow || steps[start].time - now <= URGENT_WITHIN;
  // Axis labels on whole hours only, at most five, each under the centre of its bar.
  const hours = steps.map((s, i) => ({ i, s })).filter(({ s }) => formatTime(s.time, tz).endsWith(":00"));
  const every = Math.max(1, Math.ceil(hours.length / 5));
  const ticks = hours
    .filter((_, k) => k % every === 0)
    .map(({ i, s }) => ({ at: (i + 0.5) / steps.length, label: formatTime(s.time, tz) }));

  // With amounts, the bars show how hard it falls (and how likely, as their strength); without, only the chance.
  const amounts = steps.some((s) => s.precipitation >= THRESHOLDS.minutePrecip);
  if (!amounts) {
    return {
      noun,
      headline,
      measure: "probability",
      bars: steps.map((s) => ({
        time: s.time,
        value: s.precipProbability,
        label: `${formatTime(s.time, tz)}: ${Math.round(s.precipProbability * 100)}% di probabilità`,
      })),
      ticks,
      urgent,
    };
  }

  const spell = steps.slice(start, end === -1 ? undefined : end);
  // Rates times the step's length (15 minutes, 1 or 3 hours: steps are evenly spaced)
  const stepHours = steps.length > 1 ? (steps[1].time - steps[0].time) / 3600 : 1;
  const total = steps.reduce((sum, s) => sum + s.precipitation * stepHours, 0);
  const peak = spell.reduce((a, b) => (b.precipitation > a.precipitation ? b : a), spell[0]);
  const first = spell.find((s) => s.precipitation >= THRESHOLDS.minutePrecip) ?? spell[0];
  const startWord = intensityWord(first.precipitation);
  const peakWord = intensityWord(peak.precipitation);

  // "Pioggia debole dalle 9:15, forte verso le 10:30, fino alle 12:00 circa"
  let detailed = wetNow ? `${noun} ${startWord} in corso` : `${noun} ${startWord} dalle ${from}`;
  if (peakWord !== startWord) detailed += `, ${peakWord} verso le ${formatTime(peak.time, tz)}`;
  detailed += end === -1 ? `, anche nelle ore successive` : `, fino alle ${formatTime(steps[end].time, tz)} circa`;

  const chance = Math.max(...spell.map((s) => s.precipProbability));
  return {
    noun,
    headline: detailed,
    measure: "intensity",
    bars: steps.map((s) => ({
      time: s.time,
      value: rateHeight(s.precipitation),
      chance: s.precipProbability,
      label:
        s.precipitation >= THRESHOLDS.minutePrecip
          ? `${formatTime(s.time, tz)}: ${noun.toLowerCase()} ${intensityWord(s.precipitation)}, ${Math.round(s.precipProbability * 100)}% di probabilità`
          : `${formatTime(s.time, tz)}: asciutto`,
    })),
    ticks,
    urgent,
    facts: [
      { label: "Totale", value: mm(total) },
      { label: "Picco", value: `${mm(peak.precipitation)}/h alle ${formatTime(peak.time, tz)}` },
      { label: "Probabilità", value: `fino al ${Math.round(chance * 100)}%` },
    ],
    guides: INTENSITY_GUIDES,
  };
}

export function precipOutlook(d: WeatherData): PrecipOutlook | null {
  return (
    fromMinutes(d) ??
    (d.quarterHourly ? fromSteps(d, d.quarterHourly, 6) : null) ??
    fromSteps(d, d.hourly, 12)
  );
}
