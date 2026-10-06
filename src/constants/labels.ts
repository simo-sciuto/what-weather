import type { Condition } from "@/types/weather";

/**
 * The words the interface says more than once (Italian, ADR-010), grouped by what they mean: one word, one place,
 * so a rename is one edit and two screens cannot say it two ways. Words used in one place stay there, and so do
 * sentences. The end-to-end specs read some of these as they stand: change one only on purpose.
 */

/**
 * The name of each sky. The label of a moment adds its intensity and the sky's cover (`conditionLabel`); the
 * narrative and the metrics use the bare noun, so they take it from here.
 */
export const CONDITION_NAMES = {
  clear: "Sereno",
  "partly-cloudy": "Poco nuvoloso",
  cloudy: "Nuvoloso",
  fog: "Nebbia",
  drizzle: "Pioviggine",
  rain: "Pioggia",
  thunderstorm: "Temporale",
  snow: "Neve",
} as const satisfies Record<Condition, string>;

/** Where a moment sits: the timeline's "now" and a day's name. */
export const TIME_LABELS = {
  now: "Adesso",
  today: "Oggi",
  tomorrow: "Domani",
  tonight: "Stasera",
} as const;

export const ACTION_LABELS = {
  close: "Chiudi",
  retry: "Riprova",
} as const;

/** The pages of the phone's bar and their sheets. */
export const PAGE_LABELS = {
  weather: "Meteo",
  map: "Mappa",
} as const;

export const WIND_LABELS = {
  wind: "Vento",
  calm: "Calma",
} as const;

export const MOON_LABELS = {
  newMoon: "Luna nuova",
  fullMoon: "Luna piena",
} as const;

/** The note the details give when the UV is high, and the reason the activities give for it. */
export const HIGH_UV_LABEL = "UV alto";

/** The scale the UV index and the pollen share, lowest to highest (the UV adds "Estremo" above it). */
export const LEVEL_LABELS = ["Basso", "Moderato", "Alto", "Molto alto"] as const;

/** The error our routes answer in Italian. */
export const API_ERRORS = {
  missingCoordinates: "Coordinate mancanti",
} as const;
