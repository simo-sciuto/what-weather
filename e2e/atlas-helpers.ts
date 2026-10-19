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
    jumpTo: (target: Partial<Lngs & { zoom: number }>) => void;
  };
  events: { type: string; origin: string; camera: Lngs & { zoom: number } }[];
};

declare global {
  // A global augmentation can only be an interface
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    __atlas?: AtlasProbe;
    renders?: Record<string, number>;
    __atlasField?: { canvas: HTMLCanvasElement; draws: number; field: { step: number; provider: string; lats: number[]; lons: number[] } };
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
  // The first point (M4) arrives on opening: wait for it, so every test starts with the map still and nothing in flight
  await expect(page.locator("[data-atlas-point-reading]")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-atlas-point]")).toHaveAttribute("data-phase", "resting");
  // and the first weather field (WTH-272), so nothing is in flight when a test begins
  await page.waitForFunction(() => !!window.__atlasField, null, { timeout: 30_000 });
}

/** The requests to the Atlas's own point route among `urls`, as the cells they ask for */
export const pointRequests = (urls: string[]) =>
  urls
    .filter((u) => new URL(u).pathname === "/api/atlas/point")
    .map((u) => {
      const q = new URL(u).searchParams;
      return { lat: Number(q.get("lat")), lon: Number(q.get("lon")) };
    });

/** The requests to the weather field's route among `urls` */
export const fieldRequests = (urls: string[]) => urls.filter((u) => new URL(u).pathname === "/api/atlas/field");

/** What is neither a point request, a field request nor the router's own refresh of the address (`?_rsc=`, after a point has arrived) */
export const strayRequests = (urls: string[]) =>
  urls.filter((u) => !["/api/atlas/point", "/api/atlas/field", "/icon.png"].includes(new URL(u).pathname) && !/[?&]_rsc=/.test(u));

/** The cell the map's centre falls in, as the Atlas rounds it */
export const centreCell = (page: Page) =>
  page.evaluate(() => {
    const c = window.__atlas!.map.getCenter();
    const r = (v: number) => Math.round(v * 100) / 100;
    return { lat: r(c.lat), lon: r(c.lng) };
  });

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
