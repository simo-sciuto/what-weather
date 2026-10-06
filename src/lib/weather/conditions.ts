import { CONDITION_NAMES } from "@/constants/labels";
import type { Condition } from "@/types/weather";

/** Skies that bring precipitation. */
export function isWet(condition: Condition): boolean {
  return condition === "drizzle" || condition === "rain" || condition === "thunderstorm" || condition === "snow";
}

/** What falls when it is wet: snow or rain. */
export type PrecipNoun = typeof CONDITION_NAMES.rain | typeof CONDITION_NAMES.snow;

/** "Neve" when it snows, "Pioggia" when it doesn't: the noun every precipitation line starts from. */
export function precipNoun(snow: boolean): PrecipNoun {
  return snow ? CONDITION_NAMES.snow : CONDITION_NAMES.rain;
}
