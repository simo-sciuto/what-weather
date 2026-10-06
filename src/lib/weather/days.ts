import { TIME_LABELS } from "@/constants/labels";
import { formatDate, localDay } from "./formatters";
import { capitalize } from "@/utils/string";
import { darkWithoutSunTimes, hasSunTimes } from "./sun";
import type { DailyPoint, WeatherData } from "@/types/weather";

/**
 * The days worth showing, shared by the week card and the day timeline.
 * A day the forecast barely touches (the tail of a 5-day window) would show a
 * misleading range, so it's dropped; today stays while it still has a
 * forecast ahead, since it also includes the current reading.
 */

const MAX_DAYS = 8;

export type DayInfo = {
  /** Local calendar day, "YYYY-MM-DD" */
  key: string;
  point: DailyPoint;
  isToday: boolean;
  /** "Oggi", "Stasera" or the weekday */
  name: string;
  /** "Mar" (or the name, for today) */
  short: string;
  /** "Martedì 30 settembre" */
  dateLabel: string;
  /** "30 set" */
  shortDate: string;
};

export function visibleDays(d: WeatherData): DayInfo[] {
  const tz = d.timezone;
  const todayKey = localDay(d.current.time, tz);
  const afterSunset = hasSunTimes(d) ? d.current.time > d.sunset : darkWithoutSunTimes(d);
  // Late in the day a partial "today" may rest on the current reading alone.
  const todayLeft = d.hourly.filter((h) => h.time > d.current.time && localDay(h.time, tz) === todayKey).length;

  return d.daily
    .filter((p) => localDay(p.time, tz) >= todayKey)
    .filter((p, i) => (i === 0 && localDay(p.time, tz) === todayKey ? !p.partial || todayLeft >= 2 : !p.partial))
    .slice(0, MAX_DAYS)
    .map((point) => {
      const key = localDay(point.time, tz);
      const isToday = key === todayKey;
      const name = isToday ? (afterSunset ? TIME_LABELS.tonight : TIME_LABELS.today) : capitalize(formatDate(point.time, tz, { weekday: "long" }));
      return {
        key,
        point,
        isToday,
        name,
        short: isToday ? name : capitalize(formatDate(point.time, tz, { weekday: "short" })),
        dateLabel: capitalize(formatDate(point.time, tz, { weekday: "long", day: "numeric", month: "long" })),
        shortDate: formatDate(point.time, tz, { day: "numeric", month: "short" }),
      };
    });
}
