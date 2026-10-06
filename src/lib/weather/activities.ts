import { HIGH_UV_LABEL } from "@/constants/labels";
import {
  GENERAL,
  bestWindow,
  outdoorFactors,
  outdoorScore,
  windowLabel,
  type OutdoorHour,
  type OutdoorProfile,
} from "./best-window";
import { visibleDays } from "./days";
import { localDay } from "./formatters";
import { FULL_DAY, WINDOW, hourlySamples } from "./frames";
import type { AirQuality, WeatherData } from "@/types/weather";

/**
 * What the next 24 hours, or a day of the week, are like for a few things
 * people do outside. Each
 * activity is the hour score of best-window.ts with its own profile (a run
 * wants it cooler than a walk, a bike minds the wind, a trek is out for hours
 * and minds the rain and the sun), so each gets its own best hours, a verdict
 * and, when it isn't the best one, the reason.
 *
 * Unlike the page's best hours, which only rank what the day offers, a verdict
 * is absolute: here a temperature can rule an activity out. The air counts
 * too, for the next 24 hours at once: there is one reading, for now, so it
 * says nothing of the days after.
 */

type Activity = {
  key: string;
  name: string;
  profile: OutdoorProfile;
  /** How much poor air costs it, 0..1 */
  air: number;
};

const ACTIVITIES: Activity[] = [
  {
    key: "walk",
    name: "Passeggiata",
    profile: { ...GENERAL, ideal: 21, coldSpan: 22, hotSpan: 13, comfortFloor: 0 },
    air: 0.4,
  },
  {
    key: "run",
    name: "Corsa",
    profile: { ...GENERAL, ideal: 13, coldSpan: 22, hotSpan: 16, comfortFloor: 0, uv: 0.5 },
    air: 1,
  },
  {
    key: "bike",
    name: "Bici",
    profile: {
      ...GENERAL,
      ideal: 20,
      coldSpan: 17,
      hotSpan: 14,
      comfortFloor: 0,
      rain: 1.3,
      wind: { from: 12, span: 30, cost: 0.9 },
    },
    air: 0.7,
  },
  {
    key: "hike",
    name: "Trekking",
    profile: {
      ...GENERAL,
      ideal: 16,
      coldSpan: 20,
      hotSpan: 14,
      comfortFloor: 0,
      rain: 1.3,
      wind: { from: 20, span: 35, cost: 0.8 },
      uv: 0.6,
    },
    air: 0.6,
  },
];

/** What each band of the air index (1–5) takes off, at full weight. */
const AIR_COST = [0, 0, 0.25, 0.5, 0.8];

/** The conditions, as an adjective: "Ottime", "Buone", "Discrete", "Scarse". */
const VERDICTS = ["Scarse", "Discrete", "Buone", "Ottime"] as const;
/** Scores from which the conditions are fair, good, excellent. */
const LEVELS = [0.4, 0.6, 0.8];
/** A factor has to cost at least this much to be named as the reason. */
const NOTABLE = 0.9;

export type ActivityOutlook = {
  key: string;
  name: string;
  /** 1 (poor) to 4 (excellent) */
  level: 1 | 2 | 3 | 4;
  verdict: (typeof VERDICTS)[number];
  /** Its best hours, as they follow "Meglio": "dalle 17 alle 19"; null when there are none */
  window: string | null;
  /** What holds it back: "fa caldo", "vento", "aria scarsa"; null when nothing does */
  reason: string | null;
};

/** The factor costing an hour the most, in words; null when none costs enough to say. */
function reason(h: OutdoorHour, a: Activity, air: number, aq: AirQuality | null): string | null {
  const f = outdoorFactors(h, a.profile);
  const costs: [number, string][] = [
    [f.light, "buio"],
    [
      f.dry,
      f.dry > 0
        ? "pioggia possibile"
        : h.condition === "thunderstorm"
          ? "temporali"
          : h.condition === "snow"
            ? "neve"
            : "pioggia",
    ],
    [f.comfort, h.feelsLike < a.profile.ideal ? "fa freddo" : "fa caldo"],
    [f.wind, "vento"],
    [f.sky, h.condition === "fog" ? "nebbia" : "cielo incerto"],
    [f.uv, HIGH_UV_LABEL],
    [air, aq && aq.index >= 4 ? "aria inquinata" : "aria scarsa"],
  ];
  // The first of the worst: in a tie, the order above decides.
  const [cost, words] = costs.reduce((a, b) => (b[0] < a[0] ? b : a));
  return cost < NOTABLE ? words : null;
}

/** The activities over a run of hours. With `now`, the hours start there and the windows say so ("adesso", "domani"). */
function outlook(hours: OutdoorHour[], timezone: string, aq: AirQuality | null, now?: number): ActivityOutlook[] {
  return ACTIVITIES.map((a) => {
    const air = 1 - a.air * (aq ? AIR_COST[aq.index - 1] : 0);
    const window = bestWindow(hours, a.profile);
    // The hour that speaks for the activity: the best of its window or, with none, of the daylight
    // hours (so a rainy day is poor for its rain, not for the night around it).
    const lit = hours.filter((h) => !h.night);
    const among = window ? hours.filter((h) => h.time >= window.from && h.time <= window.to) : lit.length ? lit : hours;
    const peak = among.reduce((x, y) => (outdoorScore(y, a.profile) > outdoorScore(x, a.profile) ? y : x));
    const score = window ? outdoorScore(peak, a.profile) * air : 0;
    const level = (1 + LEVELS.filter((l) => score >= l).length) as ActivityOutlook["level"];
    return {
      key: a.key,
      name: a.name,
      level,
      verdict: VERDICTS[level - 1],
      window: window && windowLabel(window, timezone, now),
      // Excellent conditions need no excuse.
      reason: level === 4 ? null : reason(peak, a, air, aq),
    };
  });
}

/** The activities over the next 24 hours, with the air as it is now. */
export function activityOutlook(d: WeatherData): ActivityOutlook[] {
  const hours = hourlySamples(d).slice(0, WINDOW + 1);
  return outlook(hours, d.timezone, d.airQuality, hours[0].time);
}

/**
 * The activities day by day, keyed by local day ("2026-10-01"), for the days
 * after today that the hours cover whole: a day they only partly cover, or
 * don't reach, has no entry (today is the next 24 hours' to tell).
 */
export function dailyActivityOutlooks(d: WeatherData): Record<string, ActivityOutlook[]> {
  const samples = hourlySamples(d);
  const byDay: Record<string, ActivityOutlook[]> = {};
  for (const day of visibleDays(d)) {
    if (day.isToday) continue;
    const hours = samples.filter((s) => localDay(s.time, d.timezone) === day.key);
    if (hours.length >= FULL_DAY) byDay[day.key] = outlook(hours, d.timezone, null);
  }
  return byDay;
}
