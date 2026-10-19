"use client";

import {
  addKept,
  keptSnapshot,
  migrateSavedPlaces,
  readKept,
  removeKept,
  type KeptStorage,
} from "@/lib/keep/kept-store";
import type { KeptRecord } from "@/lib/keep/kept-record";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

/**
 * The kept records of this device as an external store (ADR-028): the pure logic is `lib/keep`, this only gives it the
 * browser's storage and tells the readers when it changes (this tab by `notify`, the others by the `storage` event).
 * The server and the first render see no records; `ready` says the browser has been asked.
 */

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The browser's storage, or null where it is missing or refuses to be touched (a private window, blocked site data) */
function browserStorage(): KeptStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const snapshot = () => {
  const storage = browserStorage();
  return storage ? keptSnapshot(storage) : "";
};

let migrated = false;

export function useKept() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  // The records are read from the snapshot itself, so every reader parses the same string and nothing is read twice
  const records = useMemo<KeptRecord[]>(() => readKept({ getItem: () => raw || null, setItem: () => undefined }), [raw]);

  // The saved places of before become records, once per visit (the module does nothing if records were ever made)
  useEffect(() => {
    if (migrated) return;
    migrated = true;
    const storage = browserStorage();
    if (storage && migrateSavedPlaces(storage, Math.floor(Date.now() / 1000)).length > 0) notify();
  }, []);

  /** False when the device would not keep it: the caller says so */
  const keep = useCallback((record: KeptRecord) => {
    const storage = browserStorage();
    const done = storage ? addKept(storage, record) : false;
    if (done) notify();
    return done;
  }, []);

  const remove = useCallback((id: string) => {
    const storage = browserStorage();
    const done = storage ? removeKept(storage, id) : false;
    if (done) notify();
    return done;
  }, []);

  return { records, keep, remove };
}
