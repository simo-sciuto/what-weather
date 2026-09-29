"use client";

import { useSyncExternalStore } from "react";

/**
 * Tells a store "check again" once, right after mounting. A store nobody
 * notifies would keep the server's snapshot after hydration until something
 * else re-rendered the component.
 */
export function subscribeOnce(onChange: () => void) {
  queueMicrotask(onChange);
  return () => {};
}

/**
 * False on the server and while hydrating, true once in the browser: for
 * what only the browser knows (localStorage, the viewer's time zone), so the
 * first render matches the server's markup and the real value follows.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeOnce, () => true, () => false);
}
