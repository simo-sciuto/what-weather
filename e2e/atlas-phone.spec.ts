import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { centre, crosshairAndMapCentres, isWeatherRequest, movementEnded, openAtlas, recordRequests, zoom } from "./atlas-helpers";

/*
 * M3 on an emulated phone (Pixel 7, touch events sent through the browser's own protocol). This is an emulation: a real
 * phone, with its real touch screen, GPU and browser chrome, is not tested here, and is reported separately.
 */

type Point = { x: number; y: number };

async function touch(cdp: CDPSession, type: "touchStart" | "touchMove" | "touchEnd", points: Point[]) {
  await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((p, id) => ({ x: p.x, y: p.y, id })) });
}

async function swipe(page: Page, from: Point, to: Point, steps = 10) {
  const cdp = await page.context().newCDPSession(page);
  await touch(cdp, "touchStart", [from]);
  for (let i = 1; i <= steps; i++) {
    await touch(cdp, "touchMove", [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }]);
    await page.waitForTimeout(16);
  }
  await touch(cdp, "touchEnd", []);
}

/** Two fingers round a centre: their distance goes from `r0` to `r1`, and the line between them turns by `turn` degrees */
async function twoFingers(page: Page, at: Point, r0: number, r1: number, turn = 0, steps = 12) {
  const cdp = await page.context().newCDPSession(page);
  const pair = (r: number, deg: number): Point[] => {
    const a = (deg * Math.PI) / 180;
    return [
      { x: at.x - r * Math.cos(a), y: at.y - r * Math.sin(a) },
      { x: at.x + r * Math.cos(a), y: at.y + r * Math.sin(a) },
    ];
  };
  await touch(cdp, "touchStart", pair(r0, 0));
  for (let i = 1; i <= steps; i++) {
    await touch(cdp, "touchMove", pair(r0 + ((r1 - r0) * i) / steps, (turn * i) / steps));
    await page.waitForTimeout(16);
  }
  await touch(cdp, "touchEnd", []);
}

test("on a phone the map fills the screen, the crosshair is at its centre, and nothing of the page scrolls", async ({ page }) => {
  await openAtlas(page);
  const m = await page.evaluate(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
    scrollW: document.documentElement.scrollWidth,
    scrollH: document.documentElement.scrollHeight,
    box: window.__atlas!.map.getContainer().getBoundingClientRect().toJSON(),
  }));
  expect(m.scrollW).toBeLessThanOrEqual(m.w);
  expect(m.scrollH).toBeLessThanOrEqual(m.h + 1);
  expect(Math.abs(m.box.width - m.w)).toBeLessThan(1);
  expect(Math.abs(m.box.height - m.h)).toBeLessThan(2);
  const marks = await crosshairAndMapCentres(page);
  expect(Math.abs(marks.crosshair.x - marks.map.x)).toBeLessThan(1);
  expect(Math.abs(marks.crosshair.y - marks.map.y)).toBeLessThan(1);
  for (const selector of ["[data-atlas-readout]", ".mapboxgl-ctrl-attrib", ".mapboxgl-ctrl-logo", "[data-atlas] a"]) {
    const box = await page.locator(selector).first().boundingBox();
    expect(box, selector).not.toBeNull();
    expect(box!.x, selector).toBeGreaterThanOrEqual(0);
    expect(box!.y, selector).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, selector).toBeLessThanOrEqual(m.w + 1);
    expect(box!.y + box!.height, selector).toBeLessThanOrEqual(m.h + 1);
  }
});

test("a finger drags the map, the page does not scroll, and the crosshair stays", async ({ page }) => {
  await openAtlas(page);
  const before = await centre(page);
  const marks = await crosshairAndMapCentres(page);
  await swipe(page, { x: 200, y: 500 }, { x: 140, y: 300 });
  await movementEnded(page);
  const after = await centre(page);
  expect(Math.abs(after.lng - before.lng) + Math.abs(after.lat - before.lat)).toBeGreaterThan(0.05);
  expect(await page.evaluate(() => ({ y: window.scrollY, x: window.scrollX }))).toEqual({ x: 0, y: 0 });
  expect(await crosshairAndMapCentres(page)).toEqual(marks);
  expect(await page.locator("[data-atlas-readout]").textContent()).toMatch(/° N · .*° [EO]$/);
});

test("two fingers pinch to zoom and twist to rotate, and the browser's own page zoom does not move", async ({ page }) => {
  await openAtlas(page);
  const z0 = await zoom(page);
  await twoFingers(page, { x: 200, y: 400 }, 40, 140);
  await movementEnded(page);
  expect(await zoom(page)).toBeGreaterThan(z0 + 0.5);

  const bearing0 = await page.evaluate(() => window.__atlas!.map.getBearing());
  await twoFingers(page, { x: 200, y: 400 }, 100, 100, 50);
  await movementEnded(page);
  expect(Math.abs((await page.evaluate(() => window.__atlas!.map.getBearing())) - bearing0)).toBeGreaterThan(10);

  expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
});

test("a finger takes over from a movement made by the code: the movement of the hand is the person's", async ({ page }) => {
  await openAtlas(page);
  await page.evaluate(() => window.__atlas!.port.flyTo({ lng: 9.5, lat: 45.6, zoom: 8 }, { durationMs: 1800 }));
  await page.waitForTimeout(450);
  await swipe(page, { x: 200, y: 500 }, { x: 150, y: 420 });
  await movementEnded(page);
  const marks = await page.evaluate(() => window.__atlas!.events.filter((e) => e.type !== "move").map((e) => `${e.type}:${e.origin}`));
  expect(marks).toEqual(["movestart:program", "moveend:program", "movestart:user", "moveend:user"]);
  const end = await centre(page);
  expect(Math.hypot(end.lng - 9.5, end.lat - 45.6)).toBeGreaterThan(0.3);
});

test("a touch movement asks for nothing: no weather, no request of any kind", async ({ page }) => {
  await openAtlas(page);
  const seen = recordRequests(page);
  await swipe(page, { x: 200, y: 500 }, { x: 120, y: 300 });
  await twoFingers(page, { x: 200, y: 400 }, 40, 120);
  await page.waitForTimeout(1500);
  seen.stop();
  expect(seen.urls.filter(isWeatherRequest)).toEqual([]);
  expect(seen.urls).toEqual([]);
});
