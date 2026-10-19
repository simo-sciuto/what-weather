/**
 * The page's three stations and the verb of each (ADR-028): the path in the bar, the sections of the page and the
 * action of the bar all read from here, so a word is written once. The ids are the anchors (`#esplora`, `#crea`,
 * `#conserva`) the old addresses already used.
 */

export const STATIONS = [
  { id: "esplora", number: "01", label: "Esplora", sentence: "Scopri un luogo", verb: "Esplora" },
  { id: "crea", number: "02", label: "Crea", sentence: "Crea un record", verb: "Crea" },
  { id: "conserva", number: "03", label: "Conserva", sentence: "Conserva il risultato", verb: "Conserva" },
] as const;

export type StationId = (typeof STATIONS)[number]["id"];

export const STATION_IDS = STATIONS.map((s) => s.id) as readonly StationId[];

/** The heading's id of a station, for the section's `aria-labelledby` and for moving focus there */
export const stationTitleId = (id: StationId) => `${id}-title`;
