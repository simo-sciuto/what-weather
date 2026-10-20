import { INSTANT_TOLERANCE_SECONDS } from "@/constants/moment";
import type { WeatherField } from "@/types/atlas";

/**
 * The colours of the field at the hour on show (WTH-345): now's for "Adesso", the hour's own within half an hour, or now's
 * marked as now's when the field does not reach that hour, so the page can say so (ADR-030, never another hour's colours
 * shown as if they were this one's).
 */
export type FieldColours = { colors: string[]; time: number; nowOnly: boolean };

export function fieldColorsAt(field: WeatherField, instant: number | null): FieldColours {
  if (instant === null) return { colors: field.colors, time: field.time, nowOnly: false };
  let best: { colors: string[]; time: number } | null = null;
  for (const h of field.hours ?? []) {
    if (Math.abs(h.time - instant) > INSTANT_TOLERANCE_SECONDS) continue;
    if (!best || Math.abs(h.time - instant) < Math.abs(best.time - instant)) best = h;
  }
  return best && best.colors.length === field.colors.length ? { colors: best.colors, time: best.time, nowOnly: false } : { colors: field.colors, time: field.time, nowOnly: true };
}
