import { expect, test, type Page } from "@playwright/test";

/*
 * The Atlas under test (M3): its map is drawn over an empty style (NEXT_PUBLIC_ATLAS_BLANK_MAP, see
 * src/components/atlas/atlas-test.ts), and the build exposes the map, the camera port and the events the port has
 * heard as window.__atlas, and a count of renders by component as window.renders.
 */

export type Lngs = { lng: number; lat: number };
export type AtlasProbe = {
  map: {
    getCenter: () => Lngs;
    getZoom: () => number;
    getBearing: () => number;
    getPitch: () => number;
    unproject: (point: [number, number]) => Lngs;
    getContainer: () => HTMLElement;
  };
  port: {
    flyTo: (target: Partial<Lngs & { zoom: number }>, options?: { durationMs?: number }) => void;
  };
  events: { type: string; origin: string; camera: Lngs & { zoom: number } }[];
};

declare global {
  // A global augmentation can only be an interface
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    __atlas?: AtlasProbe;
    renders?: Record<string, number>;
    next?: { router: { push: (href: string) => void; replace: (href: string) => void; back: () => void } };
  }
}

/** Opens /atlas with nothing allowed to leave the machine (the map's own telemetry is refused), and waits for the map */
export async function openAtlas(page: Page): Promise<void> {
  await page.route(
    (url) => !["localhost", "127.0.0.1"].includes(url.hostname),
    (route) => route.abort(),
  );
  await page.goto("/atlas");
  const webgl = await page.evaluate(() => !!document.createElement("canvas").getContext("webgl2"));
  test.skip(!webgl, "this browser has no WebGL, so Mapbox GL cannot draw");
  await expect(page.locator("[data-atlas-map]")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  await page.waitForFunction(() => !!window.__atlas);
}

export const centre = (page: Page) => page.evaluate(() => window.__atlas!.map.getCenter());
export const zoom = (page: Page) => page.evaluate(() => window.__atlas!.map.getZoom());

/** Waits for the map to be still: the last thing the port heard is the end of a movement, and nothing more follows it */
export async function movementEnded(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => window.__atlas!.events.at(-1)?.type)).toBe("moveend");
  await page.waitForTimeout(250);
  await expect.poll(() => page.evaluate(() => window.__atlas!.events.at(-1)?.type)).toBe("moveend");
}

/** The centre of the crosshair on the screen, and of the map's container */
export async function crosshairAndMapCentres(page: Page) {
  return page.evaluate(() => {
    const mark = document.querySelector("[data-atlas-crosshair]")!.getBoundingClientRect();
    const box = window.__atlas!.map.getContainer().getBoundingClientRect();
    return {
      crosshair: { x: mark.left + mark.width / 2, y: mark.top + mark.height / 2 },
      map: { x: box.left + box.width / 2, y: box.top + box.height / 2 },
    };
  });
}

/** Everything the page asked its own server for after this call, until `stop()`: nothing the Atlas does may be a weather request */
export function recordRequests(page: Page) {
  const urls: string[] = [];
  const on = (r: { url: () => string }) => urls.push(r.url());
  page.on("request", on);
  return {
    urls,
    stop: () => page.off("request", on),
  };
}

export const isWeatherRequest = (url: string) => /\/api\/|[?&]lat=|_rsc=|\/weather/.test(url);
