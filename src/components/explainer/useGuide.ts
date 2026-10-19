import { useEffect } from "react";

const KEY = "what-weather:guide-seen";

/**
 * The guide plays by itself the first time someone arrives (once per browser, remembered), and is always there to be seen
 * again. It does not play by itself for a person who asked for less motion, nor on a sample sky (`?mock`, the tests and the
 * reviews), nor where the browser cannot remember (then it would play on every visit).
 */
export function useGuide(play: () => void) {
  useEffect(() => {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (new URLSearchParams(window.location.search).has("mock")) return;
      if (window.localStorage.getItem(KEY)) return;
      window.localStorage.setItem(KEY, String(Date.now()));
    } catch {
      return;
    }
    // a beat after the page has drawn, so the first thing seen is the weather, then the guide
    const t = window.setTimeout(play, 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
