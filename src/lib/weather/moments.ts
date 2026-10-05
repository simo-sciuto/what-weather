import { isWet } from "./constants";
import { conditionLabel, formatTemp, spokenTime } from "./formatters";
import { capitalize } from "@/utils/string";
import type { SunEvent } from "@/types/sky";
import type { Condition, DailyPoint, Intensity } from "@/types/weather";

/**
 * The sentences under the temperature when the timeline is away from now:
 * one for an hour, one for a whole day. The reading above already gives the
 * sky and the number, so these say what it doesn't — how the moment compares
 * (with now, with the rest of the day), what else is worth knowing then
 * (feels-like, rain, wind), and the sun if it rises or sets around then.
 */

export type MomentSample = {
  time: number;
  temp: number;
  feelsLike: number;
  condition: Condition;
  intensity: Intensity;
  cloudCover: number;
  precipProbability: number;
  windSpeed: number;
  night: boolean;
};

export type MomentContext = {
  timezone: string;
  /** Temperature now */
  nowTemp: number;
  /** The next 24 hours' extremes, when the moment falls within them */
  window?: { max: number; min: number };
  /** The day's own extremes, for moments further out */
  day?: { high: number; low: number };
  events: SunEvent[];
};

const round = (t: number) => Math.round(t) || 0;
const percent = (p: number) => `${Math.round(p * 100)}%`;
/** "al 60%", "all’85%": elided before the numbers said with a vowel (uno, otto, undici, ottanta…). */
const atPercent = (p: number) => {
  const n = Math.round(p * 100);
  return `${n === 1 || n === 8 || n === 11 || (n >= 80 && n <= 89) ? "all’" : "al "}${n}%`;
};

/** The sky with some character, a little different by night. */
function skyWords(s: MomentSample): string {
  switch (s.condition) {
    case "clear":
      return s.night ? "Notte serena" : "Cielo sereno";
    case "partly-cloudy":
      return "Qualche nuvola";
    case "cloudy":
      return s.cloudCover >= 90 ? "Cielo coperto" : "Nuvoloso";
    default:
      return conditionLabel(s);
  }
}

/** How this moment stands against now, or against its day. */
function comparison(s: MomentSample, ctx: MomentContext): string {
  const t = round(s.temp);
  const now = round(ctx.nowTemp);
  if (ctx.window) {
    if (t === round(ctx.window.max) && t > now) return "la massima delle 24 ore";
    if (t === round(ctx.window.min) && t < now) return "la minima delle 24 ore";
    const delta = t - now;
    if (Math.abs(delta) < 2) return "come adesso";
    return `${Math.abs(delta)}° ${delta < 0 ? "in meno" : "in più"}`;
  }
  if (ctx.day) {
    if (t >= round(ctx.day.high)) return "il picco del giorno";
    if (t <= round(ctx.day.low)) return "il minimo del giorno";
  }
  return "";
}

/** Only what matters at that hour: a feels-like that differs, rain, a real wind. */
function extras(s: MomentSample): string[] {
  const out: string[] = [];
  if (Math.abs(s.feelsLike - s.temp) >= 3) out.push(`percepiti ${formatTemp(s.feelsLike)}`);
  // A wet hour already names its rain; a dry one says it might come
  if (s.precipProbability >= 0.3) {
    out.push(isWet(s.condition) ? `probabilità ${percent(s.precipProbability)}` : `pioggia ${atPercent(s.precipProbability)}`);
  }
  if (s.windSpeed >= 30) out.push(`vento a ${Math.round(s.windSpeed)} km/h`);
  return out;
}

/** Sunrise or sunset within the hour around the moment. */
function sunWords(s: MomentSample, ctx: MomentContext): string {
  const e = ctx.events.find((x) => Math.abs(x.time - s.time) <= 3600);
  if (!e) return "";
  return `${e.type === "sunset" ? "Tramonto" : "Alba"} ${spokenTime(e.time, ctx.timezone, "alle")}`;
}

/** "Notte serena, 18°: 3° in meno. Tramonto alle 19:10." */
export function momentSummary(s: MomentSample, ctx: MomentContext): string {
  const compare = comparison(s, ctx);
  const first = `${skyWords(s)}, ${formatTemp(s.temp)}${compare ? `: ${compare}` : ""}.`;
  const more = extras(s);
  const sun = sunWords(s, ctx);
  // At most three short sentences; with a lot to say, the sun gives way.
  const rest = [more.length ? `${capitalize(more.join(", "))}.` : "", sun && more.length < 2 ? `${sun}.` : ""];
  return [first, ...rest].filter(Boolean).join(" ");
}

const DAY_SKY: Record<Condition, string> = {
  clear: "Giornata serena",
  "partly-cloudy": "Sole e qualche nuvola",
  cloudy: "Giornata nuvolosa",
  fog: "Giornata nebbiosa",
  drizzle: "Pioviggine a tratti",
  rain: "Giornata piovosa",
  thunderstorm: "Giornata temporalesca",
  snow: "Giornata nevosa",
};

/**
 * A day in short sentences: its sky and range, when it is warmest, and when
 * rain is likely. Hours give the times; beyond them, the day's own figures.
 * "Giornata serena, da 17° a 25°. Picco verso le 15."
 */
export function daySummary(p: DailyPoint, hours: MomentSample[], timezone: string): string {
  let first = `${DAY_SKY[p.condition]}, da ${formatTemp(p.min)} a ${formatTemp(p.max)}.`;
  if (hours.length > 2) {
    const peak = hours.reduce((a, b) => (b.temp > a.temp ? b : a));
    first += ` Picco ${spokenTime(peak.time, timezone, "verso le")}.`;
  }

  const wet = hours.filter((h) => isWet(h.condition) && h.precipProbability >= 0.4);
  if (wet.length) {
    const noun = wet.some((h) => h.condition === "snow") ? "Neve" : wet.some((h) => h.condition === "thunderstorm") ? "Temporali" : "Pioggia";
    const pop = atPercent(Math.max(...wet.map((h) => h.precipProbability)));
    const [a, b] = [wet[0].time, wet.at(-1)!.time];
    const when = a === b ? spokenTime(a, timezone, "verso le") : `${spokenTime(a, timezone, "dalle")} ${spokenTime(b, timezone, "alle")}`;
    return `${first} ${noun} ${when}, ${pop}.`;
  }
  if (p.precipProbability >= 0.3) return `${first} Pioggia ${atPercent(p.precipProbability)}.`;
  return first;
}
