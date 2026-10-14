import { expect, test } from "@playwright/test";
import { centrePoint } from "../src/lib/atlas/center";
import { centre, crosshairAndMapCentres, isWeatherRequest, movementEnded, openAtlas, recordRequests, zoom } from "./atlas-helpers";

/*
 * M3: /atlas, a free map. These tests check its structure and its behaviour (the map is made once and stays, the
 * gestures move it, the crosshair stays, nothing renders for a frame, nothing asks for weather), with the map drawn over
 * an empty style. They do not judge the look: that is the user's, with the real Mapbox, in a browser.
 */

test("opens on a free map: the crosshair, the centre's coordinates, Mapbox's attribution and the way back", async ({ page }) => {
  await openAtlas(page);
  await expect(page).toHaveTitle(/Esplora la mappa/);
  await expect(page.locator("canvas.mapboxgl-canvas")).toHaveCount(1);
  await expect(page.locator("[data-atlas-crosshair]")).toBeVisible();
  await expect(page.locator("[data-atlas-readout]")).toHaveText("45,0700° N · 7,6870° E");
  await expect(page.locator(".mapboxgl-ctrl-attrib")).toBeVisible();
  await expect(page.locator(".mapboxgl-ctrl-logo")).toBeVisible();
  await expect(page.getByRole("link", { name: "what-weather" })).toHaveAttribute("href", "/");
  await expect(page.getByRole("heading", { name: "Esplora la mappa" })).toBeAttached();
});

test("is the home page's sky: the atmosphere's custom properties are on the shell", async ({ page }) => {
  await openAtlas(page);
  const vars = await page.locator("[data-atlas]").evaluate((el) => ["--sky-1", "--sky-2", "--sky-3"].map((v) => (el as HTMLElement).style.getPropertyValue(v)));
  expect(vars.every((v) => /^#[0-9a-f]{6}$/i.test(v) || v.startsWith("oklch") || v.startsWith("rgb"))).toBe(true);
});

test("the map is made once, and the content of the route changes round it", async ({ page }) => {
  await openAtlas(page);
  const box = page.locator("[data-atlas-map]");
  await expect(box).toHaveAttribute("data-map-creations", "1");
  await page.evaluate(() => {
    const probe = window.__atlas as unknown as { map: { __first?: boolean }; };
    probe.map.__first = true;
    document.querySelector("canvas.mapboxgl-canvas")!.setAttribute("data-first", "yes");
  });
  const query = page.locator("[data-atlas-route-query]");
  await expect(query).toHaveAttribute("data-atlas-route-query", "");

  for (const [go, expected] of [
    ["replace('/atlas?x=1')", "x=1"],
    ["push('/atlas?x=2&y=3')", "x=2&y=3"],
    ["back()", "x=1"],
  ] as const) {
    await page.evaluate(`window.next.router.${go}`);
    await expect(query).toHaveAttribute("data-atlas-route-query", expected);
    await expect(box).toHaveAttribute("data-map-creations", "1");
    await expect(page.locator("canvas.mapboxgl-canvas[data-first=yes]")).toHaveCount(1);
    expect(await page.evaluate(() => (window.__atlas!.map as unknown as { __first?: boolean }).__first)).toBe(true);
  }

  // A change of page, not only of the address's parameters: another page inside the same layout, and back
  await page.evaluate("window.next.router.push('/atlas/persistence-check')");
  await expect(page.locator("[data-atlas-persistence-check]")).toBeAttached();
  await expect(box).toHaveAttribute("data-map-creations", "1");
  await expect(page.locator("canvas.mapboxgl-canvas[data-first=yes]")).toHaveCount(1);
  await page.evaluate("window.next.router.back()");
  await expect(query).toHaveAttribute("data-atlas-route-query", "x=1");
  await expect(box).toHaveAttribute("data-map-creations", "1");
  expect(await page.evaluate(() => (window.__atlas!.map as unknown as { __first?: boolean }).__first)).toBe(true);

  // and no second map was ever drawn
  await expect(page.locator("canvas.mapboxgl-canvas")).toHaveCount(1);
});

test("a drag moves the map under a crosshair that stays at the map's centre", async ({ page }) => {
  await openAtlas(page);
  const before = await centre(page);
  const marks = await crosshairAndMapCentres(page);
  expect(Math.abs(marks.crosshair.x - marks.map.x)).toBeLessThan(1);
  expect(Math.abs(marks.crosshair.y - marks.map.y)).toBeLessThan(1);

  await page.mouse.move(500, 400);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(500 + i * 18, 400 + i * 6);
    await page.waitForTimeout(25);
  }
  // while the button is still down, the readout already follows the map
  const midway = await page.locator("[data-atlas-readout]").textContent();
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__atlas!.events.at(-1)?.type)).toBe("moveend");

  const after = await centre(page);
  expect(Math.abs(after.lng - before.lng) + Math.abs(after.lat - before.lat)).toBeGreaterThan(0.05);
  expect(midway).not.toBe("45,0700° N · 7,6870° E");
  const stays = await crosshairAndMapCentres(page);
  expect(stays).toEqual(marks);

  // The point the crosshair marks is the point the map reports as its centre, whatever the padding (none here)
  const unprojected = await page.evaluate(
    ([x, y]) => window.__atlas!.map.unproject([x, y]),
    [marks.map.x - (await page.evaluate(() => window.__atlas!.map.getContainer().getBoundingClientRect().left)), marks.map.y - (await page.evaluate(() => window.__atlas!.map.getContainer().getBoundingClientRect().top))] as [number, number],
  );
  expect(Math.abs(unprojected.lng - after.lng)).toBeLessThan(1e-6);
  expect(Math.abs(unprojected.lat - after.lat)).toBeLessThan(1e-6);
  const text = await page.locator("[data-atlas-readout]").textContent();
  expect(text).toBe(`${Math.abs(after.lat).toFixed(4).replace(".", ",")}° ${after.lat >= 0 ? "N" : "S"} · ${Math.abs(after.lng).toFixed(4).replace(".", ",")}° ${after.lng >= 0 ? "E" : "O"}`);
});

test("the wheel zooms, the keyboard moves, and a drag with Control rotates and tilts", async ({ page }) => {
  await openAtlas(page);
  const z0 = await zoom(page);
  await page.mouse.move(640, 360);
  await page.mouse.wheel(0, -300);
  await expect.poll(() => zoom(page)).toBeGreaterThan(z0 + 0.3);
  await movementEnded(page);

  const c0 = await centre(page);
  await page.evaluate(() => (document.querySelector("canvas.mapboxgl-canvas") as HTMLElement).focus());
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await centre(page)).lng).toBeGreaterThan(c0.lng);
  await movementEnded(page);
  const z1 = await zoom(page);
  await page.keyboard.press("Equal");
  await expect.poll(() => zoom(page)).toBeGreaterThan(z1);
  await movementEnded(page);

  const view0 = await page.evaluate(() => ({ bearing: window.__atlas!.map.getBearing(), pitch: window.__atlas!.map.getPitch() }));
  await page.mouse.move(640, 400);
  await page.keyboard.down("Control");
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(640 + i * 10, 400 - i * 12);
    await page.waitForTimeout(25);
  }
  await page.mouse.up();
  await page.keyboard.up("Control");
  await expect.poll(() => page.evaluate(() => window.__atlas!.map.getBearing())).not.toBe(view0.bearing);
  expect(await page.evaluate(() => window.__atlas!.map.getPitch())).toBeGreaterThan(view0.pitch);
});

test("a person's hand takes over from a movement made by the code: the flight ends as the code's, the hand's movement is the person's", async ({ page }) => {
  await openAtlas(page);
  const target = { lng: 9.5, lat: 45.6 };
  await page.evaluate((t) => window.__atlas!.port.flyTo({ ...t, zoom: 8 }, { durationMs: 1800 }), target);
  await page.waitForTimeout(450);
  await page.mouse.move(500, 400);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(500 + i * 14, 400 + i * 5);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__atlas!.events.filter((e) => e.type === "moveend" && e.origin === "user").length)).toBeGreaterThan(0);
  await page.waitForTimeout(600);

  const marks = await page.evaluate(() => window.__atlas!.events.filter((e) => e.type !== "move").map((e) => `${e.type}:${e.origin}`));
  expect(marks).toEqual(["movestart:program", "moveend:program", "movestart:user", "moveend:user"]);
  const end = await centre(page);
  // the flight did not carry on to its target after the hand took over
  expect(Math.hypot(end.lng - target.lng, end.lat - target.lat)).toBeGreaterThan(0.3);
  await page.waitForTimeout(2000);
  expect(await centre(page)).toEqual(end);
});

test("nothing renders for a frame of a movement, and the only text that follows the map is the readout", async ({ page }) => {
  await openAtlas(page);
  const first = await page.evaluate(() => ({ ...window.renders }));
  expect(first.shell).toBeGreaterThan(0);

  await page.mouse.move(500, 400);
  await page.mouse.down();
  const seen = new Set<string>();
  for (let i = 1; i <= 30; i++) {
    await page.mouse.move(500 + i * 6, 400 + i * 2);
    seen.add((await page.locator("[data-atlas-readout]").textContent()) ?? "");
  }
  await page.mouse.up();
  await page.mouse.wheel(0, -400);
  await expect.poll(() => page.evaluate(() => window.__atlas!.events.at(-1)?.type)).toBe("moveend");
  await page.waitForTimeout(800);

  expect(seen.size).toBeGreaterThan(10);
  // The counts are the same as before the movement: not one render of the shell, the map, the crosshair or the readout
  expect(await page.evaluate(() => ({ ...window.renders }))).toEqual(first);
});

test("nothing the map does asks for weather, and a movement asks for nothing at all", async ({ page }) => {
  await openAtlas(page);
  const seen = recordRequests(page);
  await page.mouse.move(500, 400);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(500 + i * 15, 400 + i * 4);
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.mouse.wheel(0, -300);
  await page.keyboard.press("ArrowLeft");
  await page.evaluate(() => window.__atlas!.port.flyTo({ lng: 8.5, lat: 45.3 }, { durationMs: 400 }));
  await page.waitForTimeout(2500);
  seen.stop();
  expect(seen.urls.filter(isWeatherRequest)).toEqual([]);
  expect(seen.urls).toEqual([]);
});

test("the point the crosshair marks is the map's centre, with and without padding", async ({ page }) => {
  await openAtlas(page);
  for (const padding of [{ top: 0, right: 0, bottom: 0, left: 0 }, { top: 40, right: 10, bottom: 200, left: 120 }]) {
    const { size, centre } = await page.evaluate((p) => {
      const { map } = window.__atlas!;
      (map as unknown as { setPadding: (p: object) => void }).setPadding(p);
      const box = map.getContainer();
      return { size: { width: box.clientWidth, height: box.clientHeight }, centre: map.getCenter() };
    }, padding);
    const { x, y } = centrePoint(size, padding);
    const at = await page.evaluate(([px, py]) => window.__atlas!.map.unproject([px, py]), [x, y]);
    expect(Math.abs(at.lng - centre.lng)).toBeLessThan(1e-6);
    expect(Math.abs(at.lat - centre.lat)).toBeLessThan(1e-6);
  }
});

test("the keyboard reaches the map first, then Mapbox's own links and the way back, each with a visible ring", async ({ page }) => {
  await openAtlas(page);
  const focused = () =>
    page.evaluate(() => {
      const a = document.activeElement as HTMLElement;
      const cs = getComputedStyle(a);
      return { tag: a.tagName, style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), color: cs.outlineColor, visible: a.matches(":focus-visible") };
    });
  await page.keyboard.press("Tab");
  const canvas = await focused();
  expect(canvas.tag).toBe("CANVAS");
  expect(canvas.visible).toBe(true);
  expect(canvas.style).toBe("solid");
  expect(canvas.width).toBeGreaterThanOrEqual(2);
  // not the browser's near-black default
  expect(canvas.color).not.toBe("rgb(16, 16, 16)");
  let wordmark = false;
  for (let i = 0; i < 4 && !wordmark; i++) {
    await page.keyboard.press("Tab");
    const f = await focused();
    if (f.tag === "A") {
      expect(f.style).toBe("solid");
      expect(f.width).toBeGreaterThanOrEqual(2);
      expect(f.color).not.toBe("rgb(16, 16, 16)");
    }
    wordmark = await page.evaluate(() => document.activeElement?.getAttribute("href") === "/");
  }
  expect(wordmark).toBe(true);
});

test("the home page is not the Atlas, and the Atlas is not offered to search engines", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-atlas]")).toHaveCount(0);
  await expect(page.locator("canvas.mapboxgl-canvas")).toHaveCount(0);
  await page.goto("/atlas");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
