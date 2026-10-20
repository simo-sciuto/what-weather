import { describe, expect, it, vi } from "vitest";
import { createSectionStore, type SectionWindow } from "./section-store";

/** A window that keeps a history, enough for the store: pushState moves the address, `go` is Back and Forward */
function fakeWindow(url: string) {
  const entries = [url];
  let at = 0;
  const handlers = new Map<string, Set<() => void>>();
  const parts = () => {
    const u = new URL(entries[at], "http://x.test");
    return { pathname: u.pathname, search: u.search, hash: u.hash };
  };
  const win: SectionWindow = {
    get location() {
      return parts();
    },
    history: {
      pushState(_s, _u, next) {
        entries.splice(at + 1);
        entries.push(next);
        at++;
      },
    },
    addEventListener: (type, l) => void (handlers.get(type) ?? handlers.set(type, new Set()).get(type)!).add(l),
    removeEventListener: (type, l) => void handlers.get(type)?.delete(l),
  };
  return {
    win,
    entries,
    listeners: (type: string) => handlers.get(type)?.size ?? 0,
    go(delta: number) {
      at += delta;
      handlers.get("popstate")?.forEach((l) => l());
    },
  };
}

describe("the section store", () => {
  it("reads the section from the route and the hash", () => {
    expect(createSectionStore(fakeWindow("/?lat=1&lon=2").win).getSnapshot()).toBe("meteo");
    expect(createSectionStore(fakeWindow("/?lat=1&lon=2#crea").win).getSnapshot()).toBe("crea");
    expect(createSectionStore(fakeWindow("/crea?lat=1&lon=2").win).getSnapshot()).toBe("crea");
    expect(createSectionStore(fakeWindow("/crea#meteo").win).getSnapshot()).toBe("meteo");
  });

  it("a switch pushes one step with the query kept, and tells its readers itself", () => {
    const w = fakeWindow("/?lat=45.07&lon=7.69&mock=clear");
    const store = createSectionStore(w.win);
    const seen = vi.fn();
    store.subscribe(seen);
    expect(store.select("crea")).toBe(true);
    expect(w.entries.at(-1)).toBe("/?lat=45.07&lon=7.69&mock=clear#crea");
    expect(store.getSnapshot()).toBe("crea");
    expect(seen).toHaveBeenCalledTimes(1);
    // back to Meteo writes no hash on the home route
    store.select("meteo");
    expect(w.entries.at(-1)).toBe("/?lat=45.07&lon=7.69&mock=clear");
  });

  it("choosing the section already on show does nothing", () => {
    const w = fakeWindow("/?lat=1&lon=2#crea");
    const store = createSectionStore(w.win);
    expect(store.select("crea")).toBe(false);
    expect(w.entries).toHaveLength(1);
  });

  it("an entry route keeps its path and writes the hash", () => {
    const w = fakeWindow("/crea?lat=1&lon=2");
    const store = createSectionStore(w.win);
    store.select("meteo");
    expect(w.entries.at(-1)).toBe("/crea?lat=1&lon=2#meteo");
    store.select("crea");
    expect(w.entries.at(-1)).toBe("/crea?lat=1&lon=2#crea");
  });

  it("Back and Forward bring the section back, and are somebody's change", () => {
    const w = fakeWindow("/?lat=1&lon=2");
    const store = createSectionStore(w.win);
    store.subscribe(() => undefined);
    store.select("crea");
    store.takeMoved();
    w.go(-1);
    expect(store.getSnapshot()).toBe("meteo");
    expect(store.takeMoved()).toBe(true);
    w.go(1);
    expect(store.getSnapshot()).toBe("crea");
  });

  it("only a change of a person counts as moved, once", () => {
    const store = createSectionStore(fakeWindow("/?lat=1&lon=2#crea").win);
    expect(store.takeMoved()).toBe(false);
    store.select("meteo");
    expect(store.takeMoved()).toBe(true);
    expect(store.takeMoved()).toBe(false);
  });

  it("listens to the history only while somebody reads it", () => {
    const w = fakeWindow("/");
    const store = createSectionStore(w.win);
    expect(w.listeners("popstate")).toBe(0);
    const stop = store.subscribe(() => undefined);
    expect(w.listeners("popstate")).toBe(1);
    stop();
    expect(w.listeners("popstate")).toBe(0);
  });
});
