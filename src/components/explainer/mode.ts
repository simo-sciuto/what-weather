import { useSyncExternalStore } from "react";

/**
 * The home page as three parts, as the schema has it: EXPLORE (scopro un luogo), CREATE (creo un record), KEEP (conservo
 * il risultato). Which one the page is in is kept in the address (`#esplora`, `#crea`, `#conserva`), so each can be linked,
 * reloaded and reached by the Back button; the page's blocks show or hide by it (see `.only-*` and `.not-*` in globals.css).
 * The weather, on the left, is the same in all three: it is what the three are about.
 */

export const MODES = ["esplora", "crea", "conserva"] as const;
export type Mode = (typeof MODES)[number];

const EVENT = "ww-mode";

export function readMode(): Mode {
  const hash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
  return (MODES as readonly string[]).includes(hash) ? (hash as Mode) : "esplora";
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** Which of the three the page is in: Explore on the server and until the browser says otherwise */
export function useMode(): Mode {
  return useSyncExternalStore(subscribe, readMode, () => "esplora");
}

/** Goes to one of the three, in the address (replacing the entry: three tabs are not three pages to go back through) */
export function setMode(mode: Mode) {
  const url = `${window.location.pathname}${window.location.search}${mode === "esplora" ? "" : `#${mode}`}`;
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event(EVENT));
}
