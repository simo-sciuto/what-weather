import { HOUR_SECONDS } from "@/constants/time";

/**
 * The words that go with a shared poster (WTH-278): they say which moment the poster is of. The poster is of the
 * moment chosen on the timeline, not always of now, so "il cielo di adesso" is written only when it is (within half an
 * hour of the clock, and not a forecast); a past or future hour says its day and its hour on the place's clock, and a
 * forecast says it is one. Pure, so it is tested without a page.
 */

export type ShareMoment = {
  /** The moment on the poster, Unix seconds */
  time: number;
  /** The place's IANA zone or fixed offset */
  timeZone: string;
  /** The poster is of a whole day, not an hour */
  allDay: boolean;
  /** The moment is a forecast, not the current conditions */
  forecast?: boolean;
};

/** Half an hour either way of the clock is "adesso": the hour the page shows as now */
const NOW_WINDOW = HOUR_SECONDS / 2;

/** The calendar day of a moment on the place's clock, as year-month-day */
function dayKeyOf(ts: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts * 1000));
  } catch {
    return new Date(ts * 1000).toISOString().slice(0, 10);
  }
}

/** "oggi", "domani", "ieri", or the weekday and date ("sabato 26 ottobre"), on the place's clock */
export function dayWord(ts: number, now: number, timeZone: string): string {
  const key = dayKeyOf(ts, timeZone);
  for (const [offset, word] of [[0, "oggi"], [1, "domani"], [-1, "ieri"]] as const) {
    if (key === dayKeyOf(now + offset * 24 * HOUR_SECONDS, timeZone)) return word;
  }
  try {
    return new Intl.DateTimeFormat("it-IT", { timeZone, weekday: "long", day: "numeric", month: "long" }).format(new Date(ts * 1000));
  } catch {
    return key;
  }
}

/** "15:00" on the place's clock */
function clockOf(ts: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("it-IT", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ts * 1000));
  } catch {
    return new Date(ts * 1000).toISOString().slice(11, 16);
  }
}

export function shareText(placeName: string, moment: ShareMoment, now: number): string {
  const tail = "in un poster. Il meteo è qui:";
  if (!moment.allDay && !moment.forecast && Math.abs(moment.time - now) <= NOW_WINDOW) return `${placeName}, il cielo di adesso ${tail}`;
  const day = dayWord(moment.time, now, moment.timeZone);
  if (moment.allDay) return `${placeName}, il cielo di ${day} ${tail}`;
  const at = `${day} alle ${clockOf(moment.time, moment.timeZone)}`;
  return `${placeName}, ${moment.forecast ? `il cielo previsto per ${at}` : `il cielo di ${at}`} ${tail}`;
}
