import { HOUR_SECONDS } from "@/constants/time";
import type { RouteWeatherHour, RouteWeatherSample } from "@/types/route";

/**
 * "È un buon momento per salirci?" for a summit (WTH-354, docs/VERDICT.md, ADR-031): the weather of the summit at the
 * hour on show, and of the three hours after it for storms and rain (the way down), read against the thresholds below.
 * Pure: the weather, the instant and now are passed in. The verdict is the model's estimate, never a safety judgement:
 * avalanches, the snowpack, the path's state and difficulty are not in it, and the card says so.
 *
 * The thresholds are the `weather-data` agent's proposal (2026-10-20), kept here in one place for the user to change.
 */
export const THRESHOLDS = {
  /** CAPE, J/kg: unstable air from here, and storms likely with rain from the second */
  cape: [400, 1000],
  /** Probability of rain: some from the first, likely from the second */
  rainProbability: [0.2, 0.5],
  /** mm/h that is rain whatever the probability */
  rainAmount: 1,
  /** cm/h of snow that rules a summit out */
  snowfall: 0.2,
  /** Gusts at the model's ground, km/h */
  gust: [50, 70],
  /** Free-air wind at about 3000 m, km/h, for summits from `freeWindFrom` */
  freeWind: [30, 50],
  freeWindFrom: 2200,
  /** Freezing level this far above the summit or more is fine, m */
  freezingMargin: 300,
  /** Wind chill, °C, for summits from `coldFrom` */
  chill: [-15, -25],
  coldFrom: 1500,
  /** Low cloud, %, for summits from `cloudFrom` */
  lowCloud: 80,
  cloudFrom: 2000,
  /** Lead time, hours: certainty media from the first, bassa and indicative from the second, no verdict beyond the third */
  lead: [24, 48, 72],
} as const;

export type Verdict = "good" | "caution" | "no" | "unknown";
export type Certainty = "alta" | "media" | "bassa";
type Level = "ok" | "caution" | "no";
type Factor = "storm" | "snow" | "rain" | "wind" | "freezing" | "cold" | "visibility";

/** Which factor names the reason when two weigh the same: the more dangerous first */
const ORDER: readonly Factor[] = ["storm", "snow", "rain", "wind", "freezing", "cold", "visibility"];

export type Reason = { factor: Factor; level: Level; text: string };

export type PeakOutlook = {
  verdict: Verdict;
  /** The words that go with the verdict's mark */
  word: string;
  /** At most four, the weightiest first */
  reasons: Reason[];
  /** Asked for and not given: never counted as fine */
  notEvaluated: string[];
  certainty: Certainty | null;
  /** 48 to 72 hours ahead: an indication */
  indicative: boolean;
  /** Why there is no verdict, when there is none */
  why?: string;
};

export const VERDICT_WORDS: Record<Verdict, string> = {
  good: "Buon momento.",
  caution: "Con riserva.",
  no: "Non ora.",
  unknown: "Non si può ancora dire.",
};

const STORM_CODES = new Set(["thunderstorm"]);
const finite = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);
const hhmm = (t: number, zone: string) => new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: zone }).format(t * 1000);
const round = (v: number) => Math.round(v);

/** Wind chill (JAG/TI), valid at 10 °C or less with wind of 4.8 km/h or more; the temperature itself otherwise */
export function windChill(temp: number, windKmh: number): number {
  if (temp > 10 || windKmh < 4.8) return temp;
  const v = windKmh ** 0.16;
  return 13.12 + 0.6215 * temp - 11.37 * v + 0.3965 * temp * v;
}

/** The hour that answers an instant, within half an hour; none otherwise (never another hour's weather) */
export const hourNear = (hours: readonly RouteWeatherHour[], t: number) => nearest(hours, t);

const nearest = (hours: readonly RouteWeatherHour[], t: number) => {
  let best: RouteWeatherHour | null = null;
  for (const h of hours) if (Math.abs(h.time - t) <= HOUR_SECONDS / 2 && (!best || Math.abs(h.time - t) < Math.abs(best.time - t))) best = h;
  return best;
};

/**
 * `summit` is the summit's own height when the map knows it: the sample's height is the cache's band of 100 m, the
 * verdict reads the real one (the freezing level against 3538 m, not 3500).
 */
export function peakOutlook(sample: RouteWeatherSample, instant: number, now: number, timezone = "Europe/Rome", summit: number | null = sample.ele): PeakOutlook {
  const unknown = (why: string, notEvaluated: string[] = []): PeakOutlook => ({ verdict: "unknown", word: VERDICT_WORDS.unknown, reasons: [], notEvaluated, certainty: null, indicative: false, why });
  if (summit === null || !Number.isFinite(summit)) return unknown("La quota della cima non è nota: il meteo in vetta non si può stimare.");
  const ele = summit;
  if (instant < now - HOUR_SECONDS) return unknown("Quest'ora è già passata.");
  const leadHours = (instant + 3 * HOUR_SECONDS - now) / HOUR_SECONDS;
  if (leadHours > THRESHOLDS.lead[2]) return unknown("Oltre 3 giorni le previsioni in montagna non bastano per decidere.");
  const at = nearest(sample.hours, instant);
  if (!at) return unknown("Per quest'ora qui non c'è un'ora di previsione.");
  const window = sample.hours.filter((h) => h.time >= at.time && h.time <= at.time + 3 * HOUR_SECONDS);
  // The way down must be in the forecast too: an hour near its end is not judged on half of it
  if (!sample.hours.some((h) => h.time >= at.time + 3 * HOUR_SECONDS)) return unknown("La previsione non arriva alle ore della discesa.");

  const notEvaluated: string[] = [];
  const reasons: Reason[] = [];
  const add = (factor: Factor, level: Level, text: string) => level !== "ok" && reasons.push({ factor, level, text });

  // Critical: without the sky's code or any sign of rain there is nothing to decide on
  if (window.some((h) => h.condition === null) || window.every((h) => !finite(h.precipProbability) && !finite(h.precipitation))) {
    return unknown("Il tipo di tempo previsto non c'è per quest'ora.", ["tipo di tempo"]);
  }

  // Storms over the summit's hour and the way down
  const storm = window.find((h) => h.condition !== null && STORM_CODES.has(h.condition));
  if (storm) add("storm", "no", `Temporali possibili verso le ${hhmm(storm.time, timezone)}.`);
  const capes = window.map((h) => h.cape).filter(finite);
  if (capes.length === 0) notEvaluated.push("instabilità dell'aria");
  else {
    const top = Math.max(...capes);
    const wet = window.some((h) => finite(h.precipProbability) && h.precipProbability >= 0.3);
    if (top >= THRESHOLDS.cape[1] && wet) add("storm", "no", "Aria molto instabile con pioggia probabile: temporali possibili.");
    else if (top >= THRESHOLDS.cape[0]) add("storm", "caution", "Aria instabile: possibili temporali isolati, il modello non sa dire dove.");
  }

  // Rain and snow, hour by hour over the summit's hour and the way down: each hour judged on its own numbers
  const wetCode = (h: RouteWeatherHour) => h.condition === "rain" || h.condition === "drizzle" || h.condition === "snow" || h.condition === "thunderstorm";
  const rainLevel = (h: RouteWeatherHour): Level => {
    const p = finite(h.precipProbability) ? h.precipProbability : 0;
    const mm = finite(h.precipitation) ? h.precipitation : 0;
    if (mm >= THRESHOLDS.rainAmount || (p >= THRESHOLDS.rainProbability[1] && wetCode(h))) return "no";
    return p >= THRESHOLDS.rainProbability[0] || wetCode(h) ? "caution" : "ok";
  };
  const rank = { ok: 0, caution: 1, no: 2 } as const;
  const wettest = window.reduce((a, h) => (rank[rainLevel(h)] > rank[rainLevel(a)] || (rainLevel(h) === rainLevel(a) && (h.precipProbability ?? 0) > (a.precipProbability ?? 0)) ? h : a), window[0]);
  const rainLevelThere = rainLevel(wettest);
  if (rainLevelThere !== "ok") {
    const p = finite(wettest.precipProbability) ? ` (${round(wettest.precipProbability * 100)}%)` : "";
    const mm = finite(wettest.precipitation) && wettest.precipitation >= THRESHOLDS.rainAmount ? `, ${wettest.precipitation.toFixed(1).replace(".", ",")} mm/h` : "";
    add("rain", rainLevelThere, `${rainLevelThere === "no" ? "Pioggia probabile" : "Qualche possibilità di pioggia"}${p}${mm} verso le ${hhmm(wettest.time, timezone)}.`);
  }
  const snows = window.filter((h) => finite(h.snowfall));
  if (snows.length === 0) notEvaluated.push("neve");
  else {
    const snowy = snows.find((h) => h.snowfall! > THRESHOLDS.snowfall);
    if (snowy) add("snow", "no", `Neve prevista in vetta verso le ${hhmm(snowy.time, timezone)}.`);
  }

  // Wind
  if (!finite(at.windGust10m)) notEvaluated.push("raffiche");
  else if (at.windGust10m >= THRESHOLDS.gust[1]) add("wind", "no", `Raffiche fino a ${round(at.windGust10m)} km/h, dal modello a quota più bassa: in cresta possono essere più forti.`);
  else if (at.windGust10m >= THRESHOLDS.gust[0]) add("wind", "caution", `Raffiche sui ${round(at.windGust10m)} km/h, dal modello a quota più bassa.`);
  if (ele >= THRESHOLDS.freeWindFrom) {
    if (!finite(at.freeWind)) notEvaluated.push("vento in quota");
    else if (at.freeWind >= THRESHOLDS.freeWind[1]) add("wind", "no", `Vento in quota sui ${round(at.freeWind)} km/h, stimato in quota.`);
    else if (at.freeWind >= THRESHOLDS.freeWind[0]) add("wind", "caution", `Vento in quota sui ${round(at.freeWind)} km/h, stimato in quota.`);
  }

  // Freezing level against the summit
  if (!finite(at.freezingLevel)) notEvaluated.push("zero termico");
  else if (at.freezingLevel < ele + THRESHOLDS.freezingMargin)
    add("freezing", "caution", `Zero termico a ${round(at.freezingLevel / 50) * 50} m, ${at.freezingLevel < ele ? "sotto" : "appena sopra"} la vetta (${round(ele)} m): possibile neve o ghiaccio in quota.`);

  // Cold with the wind
  if (!finite(at.temp)) notEvaluated.push("temperatura");
  else if (ele >= THRESHOLDS.coldFrom) {
    // The larger of the two winds, the free-air one only where it counts (docs/VERDICT.md)
    const wind = Math.max(at.windGust10m ?? 0, ele >= THRESHOLDS.freeWindFrom ? (at.freeWind ?? 0) : 0);
    const chill = windChill(at.temp, wind);
    if (chill <= THRESHOLDS.chill[1]) add("cold", "no", `In vetta circa ${round(at.temp)}°, col vento sembrano ${round(chill)}° (calcolato).`);
    else if (chill <= THRESHOLDS.chill[0]) add("cold", "caution", `In vetta circa ${round(at.temp)}°, col vento sembrano ${round(chill)}° (calcolato).`);
  }

  // Low cloud on a high summit
  if (ele >= THRESHOLDS.cloudFrom) {
    const low = finite(at.lowCloud) && at.lowCloud >= THRESHOLDS.lowCloud;
    const blind = (finite(at.visibility) && at.visibility < 1) || at.condition === "fog";
    if (!finite(at.lowCloud) && !finite(at.visibility)) notEvaluated.push("nubi basse");
    if (low || blind)
      add("visibility", "caution", `Nubi basse in quota verso le ${hhmm(at.time, timezone)}: il sentiero può essere difficile da seguire.`);
  }

  reasons.sort((a, b) => (a.level === b.level ? ORDER.indexOf(a.factor) - ORDER.indexOf(b.factor) : a.level === "no" ? -1 : 1));
  const critical = ["zero termico", "raffiche", "vento in quota", "temperatura"].filter((n) => notEvaluated.includes(n));
  const verdict: Verdict = reasons.some((r) => r.level === "no") ? "no" : reasons.length || critical.length ? "caution" : "good";
  if (critical.length >= 2) return unknown("Mancano troppi dati per decidere.", notEvaluated);

  // Certainty: lead time, then one step down for each of missing data, unstable air, a summit above 2500 m
  const steps: Certainty[] = ["alta", "media", "bassa"];
  let step = leadHours <= THRESHOLDS.lead[0] ? 0 : leadHours <= THRESHOLDS.lead[1] ? 1 : 2;
  if (notEvaluated.length) step++;
  if (capes.some((c) => c >= THRESHOLDS.cape[0])) step++;
  if (ele > 2500) step++;
  return {
    verdict,
    word: VERDICT_WORDS[verdict],
    reasons: reasons.slice(0, 4),
    notEvaluated,
    certainty: steps[Math.min(2, step)],
    indicative: leadHours > THRESHOLDS.lead[1],
  };
}
