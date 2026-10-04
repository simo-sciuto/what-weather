/**
 * Which palette paints the page (WTH-046L): the one the page has always had (`skyPalette`, "live") or the
 * Weather Visual Engine's atmosphere (`atmospherePalette`, "atmosphere"). A temporary switch, so the two can be
 * compared on one place on one phone before the atmosphere becomes the page's own: the address says which, and
 * the page without the parameter is the page as it was.
 *
 * The parameter is read by the server's page and handed down, not read in the browser: server and client render
 * the same palette, and the weather cached for a place (which is shared by every visitor) never depends on it.
 */
export type PaletteEngine = "live" | "atmosphere";

/** `?motore=atmosfera` */
export const ENGINE_PARAM = "motore";
export const ENGINE_ON = "atmosfera";

/** The engine an address asks for: the atmosphere for exactly `atmosfera`, the page's own for anything else. */
export function engineFromParam(value: string | string[] | undefined): PaletteEngine {
  return value === ENGINE_ON ? "atmosphere" : "live";
}

/**

 * An internal address (a path, not an absolute URL) that keeps the switch where it is: the atmosphere's parameter
 * is added to it, or set if already there, and the live page's addresses are left exactly as they were. For the
 * links and navigations between places and between the sample scenarios.
 */
export function withEngine(href: string, engine: PaletteEngine): string {
  if (engine !== "atmosphere") return href;
  // The first `#` starts the fragment, whatever follows it (even another `#`) and even if it is empty
  const hashAt = href.indexOf("#");
  const [path, hash] = hashAt < 0 ? [href, ""] : [href.slice(0, hashAt), href.slice(hashAt)];
  const queryAt = path.indexOf("?");
  const [base, query] = queryAt < 0 ? [path, ""] : [path.slice(0, queryAt), path.slice(queryAt + 1)];
  const q = new URLSearchParams(query);
  q.set(ENGINE_PARAM, ENGINE_ON);
  return `${base}?${q}${hash}`;
}
