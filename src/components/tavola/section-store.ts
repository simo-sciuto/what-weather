import { sectionHref, sectionOf, type Section } from "@/lib/sections";

/**
 * The section on show as an external store (ADR-029): the address is the truth, so the store reads it (`sectionOf` of
 * the route and the hash), listens to the history and, after a switch of its own, says so itself: `pushState` and
 * `replaceState` fire no event. The window is a parameter so the logic can be tried without a browser.
 */

export type SectionWindow = {
  location: { pathname: string; search: string; hash: string };
  history: { pushState(state: null, unused: string, url: string): void };
  addEventListener(type: "popstate" | "hashchange", listener: () => void): void;
  removeEventListener(type: "popstate" | "hashchange", listener: () => void): void;
};

export function createSectionStore(win: SectionWindow) {
  const listeners = new Set<() => void>();
  // Whether the last change was somebody's (a switch, Back, Forward) and not the page opening on its section
  let moved = false;

  const read = (): Section => sectionOf(win.location.pathname, win.location.hash);
  const notify = () => listeners.forEach((l) => l());
  const onHistory = () => {
    moved = true;
    notify();
  };

  return {
    getSnapshot: read,
    subscribe(listener: () => void) {
      if (listeners.size === 0) {
        win.addEventListener("popstate", onHistory);
        win.addEventListener("hashchange", onHistory);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          win.removeEventListener("popstate", onHistory);
          win.removeEventListener("hashchange", onHistory);
        }
      };
    },
    /** One new step in the history, the query kept as it is; false when the section is already on show */
    select(section: Section): boolean {
      if (read() === section) return false;
      const { pathname, search } = win.location;
      win.history.pushState(null, "", sectionHref(pathname, search, section));
      moved = true;
      notify();
      return true;
    },
    /** True once if a person changed the section since the last time it was asked (the page opening does not count) */
    takeMoved(): boolean {
      const was = moved;
      moved = false;
      return was;
    },
  };
}

export type SectionStore = ReturnType<typeof createSectionStore>;
