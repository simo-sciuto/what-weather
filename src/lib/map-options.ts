/**
 * Which layers the map behind the page shows, the viewer's to choose: the
 * city's own (the water, the three ranks of road), on until turned off, and
 * the extras (the meadows, the relief, the traffic), off until turned on, so
 * the page is as it always was. Kept in localStorage like the map's tuning
 * (see map-tuning.ts) and exposed the same way, as an external store; every
 * access is guarded.
 */

export const MAP_OPTIONS = ["water", "water-names", "streets", "main-roads", "motorways", "green", "relief", "contours", "rail", "buildings", "shadows", "traffic", "lights"] as const;
export type MapOption = (typeof MAP_OPTIONS)[number];

/** What the map shows until the viewer chooses otherwise: the city as it always was */
export const DEFAULT_MAP_OPTIONS: readonly MapOption[] = ["water", "water-names", "streets", "main-roads", "motorways"];

/** What each is called and says, for the controls */
export const MAP_OPTION_INFO: Record<MapOption, { label: string; hint: string }> = {
  water: { label: "Acqua", hint: "Fiumi, laghi e mare" },
  "water-names": { label: "Nomi delle acque", hint: "I nomi di fiumi, laghi e mari, e solo quelli" },
  streets: { label: "Strade", hint: "Le vie del quartiere" },
  "main-roads": { label: "Strade principali", hint: "I grandi assi" },
  motorways: { label: "Autostrade", hint: "Autostrade e tangenziali" },
  green: { label: "Verde", hint: "Parchi, prati e boschi" },
  relief: { label: "Rilievo", hint: "Colline e montagne in ombra, come le illumina il sole" },
  contours: { label: "Curve di livello", hint: "Le quote come linee sottili, colorate per altitudine" },
  rail: { label: "Ferrovie", hint: "Le linee dei treni" },
  buildings: { label: "Edifici", hint: "Le impronte, avvicinandosi" },
  shadows: { label: "Ombre", hint: "Quelle degli edifici, dal sole del momento" },
  traffic: { label: "Traffico", hint: "In diretta, dove c'è coda" },
  lights: { label: "Luci di notte", hint: "I luoghi accesi, a sole calato" },
};

// Its own key: an earlier one held only the extras, and read as a choice it would have switched the roads off.
const KEY = "weather:map-layers";

const listeners = new Set<() => void>();

export function subscribeMapOptions(onChange: () => void) {
  listeners.add(onChange);
  // Other tabs choosing.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The raw stored string: a stable snapshot that only changes when the choice does. */
export function mapOptionsSnapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

/** Nothing stored is the page's own; what is stored is the whole choice, an empty one included (everything off). */
export function parseMapOptions(raw: string): MapOption[] {
  try {
    const stored: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(stored)) return [...DEFAULT_MAP_OPTIONS];
    return MAP_OPTIONS.filter((o) => stored.includes(o));
  } catch {
    return [...DEFAULT_MAP_OPTIONS];
  }
}

export const isDefaultMapOptions = (options: readonly MapOption[]) =>
  options.length === DEFAULT_MAP_OPTIONS.length && DEFAULT_MAP_OPTIONS.every((o) => options.includes(o));

export function setMapOptions(options: readonly MapOption[]) {
  try {
    if (isDefaultMapOptions(options)) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(options));
  } catch {
    // Storage unavailable (private mode, blocked): nothing is remembered, and nothing changes.
  }
  listeners.forEach((l) => l());
}
