import { THRESHOLDS, isWet } from "./constants";
import { formatTemp, localDay, localHour, spokenTime } from "./formatters";
import { darkWithoutSunTimes, hasSunTimes } from "./sun";
import type { Condition, HourlyPoint, WeatherData } from "./types";

/**
 * Rules-based weather summary. Each rule may produce a candidate phrase with a
 * priority; the two most relevant make at most two short sentences. The voice
 * is a headline's: the fact, then when, then (only if it helps) what to do,
 * in a few words. "Pioggia dalle 14 alle 17. Serve l’ombrello."
 */

type Topic = "sky" | "precip" | "temp" | "wind" | "uv" | "air";

interface Candidate {
  topic: Topic;
  priority: number;
  /** A short sentence (or two) without the final full stop, starting with a capital letter */
  text: string;
  /** The sky without its span ("Sole e qualche nuvola"), for when the clause after it carries the time */
  bare?: string;
  /** This temperature clause names its own time, so the sky before it drops its span */
  timed?: boolean;
}

const HORIZON_HOURS = 12;
const precipLikely = (h: HourlyPoint) =>
  isWet(h.condition) && h.precipProbability >= THRESHOLDS.precipProbability;

/** Reading order when two candidates are combined. */
const ORDER: Topic[] = ["precip", "sky", "temp", "wind", "uv", "air"];

/** Is it currently dark at the place? */
function isNightNow(d: WeatherData): boolean {
  if (!hasSunTimes(d)) return darkWithoutSunTimes(d);
  return d.current.time < d.sunrise || d.current.time > d.sunset;
}

/** The first sunrise after now; separates "tonight" from "tomorrow morning". */
function nextSunrise(d: WeatherData): number {
  if (!hasSunTimes(d)) return d.current.time + 86400;
  if (d.current.time < d.sunrise) return d.sunrise;
  return d.daily.find((day) => day.sunrise && day.sunrise > d.current.time)?.sunrise ?? d.sunrise + 86400;
}

type Part = "morning" | "afternoon" | "evening" | "night";
interface Period {
  part: Part;
  tomorrow: boolean;
}

/**
 * Tonight, this afternoon, tomorrow morning… relative to now at the place,
 * by the clock as people speak: the evening runs to 22, and the small hours
 * after midnight still belong to "stanotte".
 */
function period(d: WeatherData, ts: number): Period {
  const tz = d.timezone;
  const h = localHour(ts, tz);
  const part: Part = h < 5 ? "night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 22 ? "evening" : "night";
  const tomorrow = localDay(ts, tz) !== localDay(d.current.time, tz);
  return { part, tomorrow: tomorrow && !(part === "night" && h < 5 && ts < nextSunrise(d) + 3600) };
}

const TODAY: Record<Part, string> = { morning: "stamattina", afternoon: "oggi pomeriggio", evening: "stasera", night: "stanotte" };
const PART_NAMES: Record<Part, string> = { morning: "mattina", afternoon: "pomeriggio", evening: "sera", night: "notte" };
const THROUGH: Record<Part, string> = {
  morning: "tutta la mattina",
  afternoon: "tutto il pomeriggio",
  evening: "tutta la sera",
  night: "tutta la notte",
};

/** "stasera", "domani mattina" */
const when = (p: Period) => (p.tomorrow ? `domani ${PART_NAMES[p.part]}` : TODAY[p.part]);
/** "tutto il pomeriggio", "fino a domani mattina" */
const through = (p: Period) => (p.tomorrow ? `fino a domani ${PART_NAMES[p.part]}` : THROUGH[p.part]);

/**
 * How a spell of precipitation is said: the verb for sentences ("Piove",
 * "inizia a piovere") and the noun for forecasts ("probabile pioggia").
 */
interface PrecipWords {
  /** "Piove", "Nevica" */
  now: string;
  /** "piovere", "nevicare" (after "inizia a", "smette di") */
  verb: string;
  /** "Pioggia", "Neve": what is on the way */
  noun: string;
  /** Whether an umbrella is the useful advice */
  umbrella: boolean;
}

function precipWords(hours: Pick<HourlyPoint, "condition" | "intensity">[]): PrecipWords {
  if (hours.some((h) => h.condition === "snow")) return { now: "Nevica", verb: "nevicare", noun: "Neve", umbrella: false };
  if (hours.every((h) => h.condition === "drizzle"))
    return { now: "Pioviggina", verb: "piovigginare", noun: "Pioviggine", umbrella: true };
  if (hours.some((h) => h.intensity === "heavy"))
    return { now: "Piove forte", verb: "piovere forte", noun: "Pioggia forte", umbrella: true };
  return { now: "Piove", verb: "piovere", noun: "Pioggia", umbrella: true };
}

/** The sky when a wet or foggy hour dominates but no precipitation rule spoke (e.g. a low chance). */
const SKY_WORDS: Record<Condition, string> = {
  clear: "Sereno",
  "partly-cloudy": "Poco nuvoloso",
  cloudy: "Nuvoloso",
  fog: "Nebbia",
  drizzle: "Qualche goccia",
  rain: "Tempo incerto",
  thunderstorm: "Tempo instabile",
  snow: "Qualche fiocco",
};

/** Minutes the way people say them: "tra un quarto d’ora", "tra una ventina di minuti". */
function inMinutes(min: number): string {
  if (min < 5) return "tra pochi minuti";
  if (min < 13) return "tra una decina di minuti";
  if (min < 18) return "tra un quarto d’ora";
  if (min < 25) return "tra una ventina di minuti";
  if (min < 38) return "tra mezz’ora";
  if (min < 52) return "tra tre quarti d’ora";
  return "tra circa un’ora";
}

/**
 * Forecast points within the next `h` hours. Windows are measured in time,
 * not in points, because providers step hourly or 3-hourly.
 */
function upTo(d: WeatherData, hours: HourlyPoint[], h: number): HourlyPoint[] {
  return hours.filter((p) => p.time <= d.current.time + h * 3600);
}

/* ---------- Rules ---------- */

function stormRule(d: WeatherData, hours: HourlyPoint[]): Candidate | null {
  const tz = d.timezone;
  if (d.current.condition === "thunderstorm") {
    const end = hours.find((h) => h.condition !== "thunderstorm");
    return {
      topic: "precip",
      priority: 100,
      text: end ? `Temporale in corso. Tregua ${spokenTime(end.time, tz, "verso le")}` : "Temporali per ore. Resta al riparo",
    };
  }
  const next = upTo(d, hours, 6).find((h) => h.condition === "thunderstorm");
  if (!next) return null;
  return { topic: "precip", priority: 95, text: `Temporali ${spokenTime(next.time, tz, "verso le")}` };
}

function minuteRule(d: WeatherData, hours: HourlyPoint[]): Candidate | null {
  const minutes = d.minutely;
  if (!minutes?.length) return null;
  const wet = (p: number) => p >= THRESHOLDS.minutePrecip;
  const wetNow = wet(minutes[0].precipitation);
  const change = minutes.findIndex((m) => wet(m.precipitation) !== wetNow);
  if (change <= 0) return null;
  const inMin = Math.round((minutes[change].time - d.current.time) / 60);
  if (inMin < 2) return null;
  const snow = d.current.condition === "snow";
  if (wetNow) return { topic: "precip", priority: 88, text: `Smette di ${snow ? "nevicare" : "piovere"} ${inMinutes(inMin)}` };

  // Borrow the end of the spell from the hourly forecast when it has one.
  const spell = hours.findIndex(precipLikely);
  const end = spell === -1 ? -1 : hours.findIndex((h, i) => i > spell && !precipLikely(h));
  const until = end === -1 ? "" : `, ${spokenTime(hours[end].time, d.timezone, "fino alle")}`;
  return { topic: "precip", priority: 90, text: `${snow ? "Neve" : "Pioggia"} ${inMinutes(inMin)}${until}` };
}

function hourlyPrecipRule(d: WeatherData, hours: HourlyPoint[]): Candidate | null {
  const tz = d.timezone;

  if (isWet(d.current.condition)) {
    const end = hours.findIndex((h) => !precipLikely(h));
    const w = precipWords(end > 0 ? hours.slice(0, end) : [d.current]);
    if (end === -1) return { topic: "precip", priority: 80, text: `${w.now} almeno fino a ${when(period(d, hours.at(-1)!.time))}` };
    if (end === 0) return { topic: "precip", priority: 70, text: `Smette di ${w.verb} a breve` };
    return { topic: "precip", priority: 80, text: `${w.now} ${spokenTime(hours[end].time, tz, "fino alle")}` };
  }

  const start = hours.findIndex(precipLikely);
  if (start === -1) return null;
  const rest = hours.slice(start);
  const len = rest.findIndex((h) => !precipLikely(h));
  const spell = len === -1 ? rest : rest.slice(0, len);
  const w = precipWords(spell);
  const soon = hours[start].time - d.current.time < 6 * 3600;
  const range =
    len === -1
      ? spokenTime(hours[start].time, tz, "dalle")
      : `${spokenTime(hours[start].time, tz, "dalle")} ${spokenTime(rest[len].time, tz, "alle")}`;
  // Advice only when it's close enough to act on.
  const advice = soon && w.umbrella ? ". Serve l’ombrello" : "";
  return { topic: "precip", priority: soon ? 80 : 55, text: `${w.noun} ${range}${advice}` };
}

function fogRule(d: WeatherData, hours: HourlyPoint[]): Candidate | null {
  if (d.current.condition !== "fog") return null;
  const lift = hours.find((h) => h.condition !== "fog");
  return {
    topic: "sky",
    priority: 75,
    text: lift ? `Nebbia ${spokenTime(lift.time, d.timezone, "fino alle")}` : "Nebbia fitta per ore",
  };
}

function windRule(d: WeatherData, hours: HourlyPoint[]): Candidate | null {
  const all = [{ time: d.current.time, gust: d.current.windGust ?? d.current.windSpeed }].concat(
    hours.map((h) => ({ time: h.time, gust: h.windGust ?? h.windSpeed })),
  );
  const peak = all.reduce((a, b) => (b.gust > a.gust ? b : a));
  if (peak.gust < THRESHOLDS.strongGust) return null;
  const gust = Math.round(peak.gust);
  const severe = gust >= 75;
  const text =
    peak.time === d.current.time ? `Raffiche fino a ${gust} km/h` : `Raffiche fino a ${gust} km/h ${when(period(d, peak.time))}`;
  return { topic: "wind", priority: severe ? 85 : 65, text: severe ? `${text}. Attenzione all’aperto` : text };
}

function uvRule(d: WeatherData, hours: HourlyPoint[]): Candidate | null {
  // Not every provider reports UV; without data there is nothing to say.
  const day = hours.filter((h): h is HourlyPoint & { uvIndex: number } => !h.isNight && h.uvIndex != null);
  const peak = day.reduce<(typeof day)[number] | null>((a, b) => (!a || b.uvIndex > a.uvIndex ? b : a), null);
  const nowUv = d.current.uvIndex ?? 0;
  const uv = Math.max(nowUv, peak?.uvIndex ?? 0);
  if (uv < THRESHOLDS.highUv) return null;
  const level = uv >= 11 ? "estremo" : uv >= 8 ? "molto alto" : "alto";
  const later = peak != null && peak.uvIndex > nowUv;
  const when = later ? ` ${spokenTime(peak.time, d.timezone, "verso le")}` : "";
  return { topic: "uv", priority: uv >= 8 ? 60 : 45, text: `UV ${level}${when}: serve la crema` };
}

function airRule(d: WeatherData): Candidate | null {
  const aq = d.airQuality;
  if (!aq || aq.index < 4) return null;
  return {
    topic: "air",
    priority: aq.index === 5 ? 80 : 62,
    text: aq.index === 5 ? "Aria molto inquinata: niente sport all’aperto" : "Aria inquinata: poco sport all’aperto",
  };
}

function tempRule(d: WeatherData, hours: HourlyPoint[]): Candidate | null {
  if (!hours.length) return null;
  const now = d.current.temp;
  const max = hours.reduce((a, b) => (b.temp > a.temp ? b : a));
  const min = hours.reduce((a, b) => (b.temp < a.temp ? b : a));
  const tz = d.timezone;

  // After dark, the overnight low is the number that matters.
  if (isNightNow(d)) {
    const overnight = hours.filter((h) => h.time <= nextSunrise(d));
    const low = overnight.reduce<HourlyPoint | null>((a, b) => (!a || b.temp < a.temp ? b : a), null);
    if (!low || now - low.temp < 2) return null;
    return { topic: "temp", priority: 40, text: `Minima ${formatTemp(low.temp)} ${spokenTime(low.time, tz, "verso le")}` };
  }
  const tonight = (ts: number) => {
    const p = period(d, ts);
    return p.part === "night" && !p.tomorrow;
  };

  const rise = max.temp - now;
  const drop = now - min.temp;

  // Whichever swing comes first is the one the user will feel next.
  if (rise >= THRESHOLDS.tempSwing && (max.time < min.time || drop < THRESHOLDS.tempSwing)) {
    return { topic: "temp", priority: 40, text: `Massima ${formatTemp(max.temp)} ${spokenTime(max.time, tz, "verso le")}`, timed: true };
  }
  if (drop >= THRESHOLDS.tempSwing) {
    const low = formatTemp(min.temp);
    // A low after midnight is "stanotte", never "verso l’una" (which reads as lunchtime).
    if (tonight(min.time)) return { topic: "temp", priority: 40, text: `Stanotte scende a ${low}` };
    return { topic: "temp", priority: 40, text: `Scende a ${low} ${spokenTime(min.time, tz, "verso le")}`, timed: true };
  }
  return null;
}

/**
 * Always available: the sky over the next few hours, said with some
 * character. By day it runs to the end of the window, or to sunset when that
 * comes first; after dark it is the night's sky.
 */
function skyRule(d: WeatherData, hours: HourlyPoint[]): Candidate {
  const window = [d.current.condition, ...upTo(d, hours, 6).map((h) => h.condition)];
  const counts = new Map<Condition, number>();
  for (const c of window) counts.set(c, (counts.get(c) ?? 0) + 1);
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const end = upTo(d, hours, 4).at(-1)?.time ?? hours[0]?.time ?? d.current.time;
  const night = isNightNow(d);
  // The part of the day ahead ("per tutto il pomeriggio", looking a couple of hours on so
  // late morning isn't "per tutta la mattina"), or up to sunset when that comes first.
  const pastSunset = hasSunTimes(d) && end >= d.sunset;
  const span = pastSunset ? "fino al tramonto" : through(period(d, d.current.time + 2 * 3600));

  const [bare, text] = ((): [string | undefined, string] => {
    switch (dominant) {
      case "clear":
        return night ? [undefined, "Notte limpida"] : ["Sole", `Sole ${span}`];
      case "partly-cloudy":
        return night ? [undefined, "Qualche nuvola stanotte"] : ["Sole e qualche nuvola", `Sole e qualche nuvola ${span}`];
      case "cloudy":
        return night ? [undefined, "Notte nuvolosa"] : ["Cielo grigio", `Cielo grigio ${pastSunset ? "fino a sera" : span}`];
      default:
        return [undefined, `${SKY_WORDS[dominant]} ${through(period(d, end))}`];
    }
  })();
  // "Fino al tramonto" is worth keeping even before a timed clause; a plain span is not.
  return { topic: "sky", priority: 10, text, bare: pastSunset ? undefined : bare };
}

/* ---------- Composition ---------- */

export function buildNarrative(d: WeatherData): string {
  const hours = upTo(d, d.hourly.filter((h) => h.time > d.current.time), HORIZON_HOURS);

  const precip = stormRule(d, hours) ?? minuteRule(d, hours) ?? hourlyPrecipRule(d, hours);
  const candidates = [
    precip,
    fogRule(d, hours),
    windRule(d, hours),
    uvRule(d, hours),
    airRule(d),
    tempRule(d, hours),
  ].filter((c): c is Candidate => c !== null);

  // Without a precipitation or fog story, the sky is part of the story.
  if (!candidates.some((c) => c.topic === "precip" || c.topic === "sky")) {
    candidates.push(skyRule(d, hours));
  }

  const picked = candidates
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2)
    .sort((a, b) => ORDER.indexOf(a.topic) - ORDER.indexOf(b.topic));

  if (picked.length === 0) return `${skyRule(d, hours).text}.`;

  // Short sentences, one after the other. When the temperature names its own time, the sky
  // before it drops its span ("Sole e qualche nuvola. Massima 24° verso le 15.").
  const [first, second] = picked;
  if (second?.timed && first.topic === "sky" && first.bare) return `${first.bare}. ${second.text}.`;
  return picked.map((c) => `${c.text}.`).join(" ");
}
