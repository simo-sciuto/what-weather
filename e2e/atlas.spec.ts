import { expect, test } from "@playwright/test";
import { centrePoint } from "../src/lib/atlas/center";
import { centre, centreCell, crosshairAndMapCentres, movementEnded, openAtlas, pointRequests, recordRequests, strayRequests, zoom } from "./atlas-helpers";

/*
 * M3 and M4: /atlas, a free map and the weather of the point it rests on. These tests check its structure and its
 * behaviour (the map is made once and stays, the gestures move it, the crosshair stays, nothing renders for a frame,
 * nothing is asked for while the map moves and one request follows a stop), with the map drawn over an empty style and
 * the sample weather behind the point route. They do not judge the look: that is the user's, with the real Mapbox, in a browser.
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
  // The first point has arrived and the address says so (M4); the map was not made again for it
  await expect(query).toHaveAttribute("data-atlas-route-query", "lat=45.07&lon=7.69");

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
  await page.evaluate((t) => window.__atlas!.port.flyTo({ ...t, zoom: 8 }, { durationMs: 6000 }), target);
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
  await page.mouse.move(500, 400);
  await page.mouse.down();
  await page.mouse.move(506, 402);
  // The movement has begun: the status changed once (moving), and from here to the release nothing may render
  await expect(page.locator("[data-atlas-point]")).toHaveAttribute("data-phase", "moving");
  const during = await page.evaluate(() => ({ ...window.renders }));
  expect(during.shell).toBeGreaterThan(0);
  const seen = new Set<string>();
  for (let i = 2; i <= 30; i++) {
    await page.mouse.move(500 + i * 6, 400 + i * 2);
    seen.add((await page.locator("[data-atlas-readout]").textContent()) ?? "");
  }
  expect(seen.size).toBeGreaterThan(10);
  // The counts are the same as at the first frame: not one render of the shell, the map, the crosshair, the readout or the point
  expect(await page.evaluate(() => ({ ...window.renders }))).toEqual(during);
  await page.mouse.up();
  await page.mouse.wheel(0, -400);
  await expect(page.locator("[data-atlas-point]")).toHaveAttribute("data-phase", "resting", { timeout: 15_000 });
  // A whole gesture and the point it ended on: the address changes once when the point arrives, and the shell and what
  // it holds render a few times for it (the transition's passes, the route's new content, the sky: five were counted), not once per frame; the point's own renders are the few
  // changes of status (moving, settling, loading, resting)
  const after = await page.evaluate(() => ({ ...window.renders }));
  // the mark and the coordinates have nothing to redraw for it at all; the shell and the map, a handful
  for (const name of ["crosshair", "readout"]) expect(after[name] ?? 0).toBe(during[name] ?? 0);
  for (const name of ["shell", "map"]) expect((after[name] ?? 0) - (during[name] ?? 0)).toBeLessThanOrEqual(8);
  expect((after.point ?? 0) - (during.point ?? 0)).toBeLessThan(12);
});

test("a movement asks for nothing, even held still; one request follows the stop, for the cell the map rests on", async ({ page }) => {
  await openAtlas(page);
  const seen = recordRequests(page);
  await page.mouse.move(500, 400);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(500 + i * 15, 400 + i * 4);
    await page.waitForTimeout(20);
  }
  // Held still with the button down for longer than the quiet: still moving, still nothing asked for
  await page.waitForTimeout(1500);
  expect(seen.urls).toEqual([]);
  await page.mouse.up();
  await movementEnded(page);
  await expect(page.locator("[data-atlas-point]")).toHaveAttribute("data-phase", "resting", { timeout: 15_000 });
  seen.stop();
  expect(pointRequests(seen.urls)).toEqual([await centreCell(page)]);
  expect(strayRequests(seen.urls)).toEqual([]);
});

test("the first point is the one the map opens on, with what it is, and the address follows it", async ({ page }) => {
  await openAtlas(page);
  const reading = page.locator("[data-atlas-point-reading]");
  await expect(reading).toContainText(/^-?\d+°/);
  await expect(page.locator("[data-atlas-point]")).toContainText("Dati di esempio");
  await expect(page.locator("[data-atlas-point]")).toContainText("45,07° N · 7,69° E");
  await expect(page.locator("[data-atlas-point]")).toContainText("ora locale");
  await expect(page).toHaveURL(/\/atlas\?lat=45\.07&lon=7\.69/);
  await expect(page.locator("[data-atlas-map]")).toHaveAttribute("data-map-creations", "1");
});

test("an address that names a point opens the map and the weather on that point, and carries the sample weather's parameters on", async ({ page }) => {
  const asked: string[] = [];
  page.on("request", (r) => asked.push(r.url()));
  await page.goto("/atlas?lat=44.41&lon=8.93&mock=rain&at=09:00");
  await expect(page.locator("[data-atlas-point-reading]")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-atlas-point]")).toContainText("44,41° N · 8,93° E");
  // and the map is there too: the point on show is the one under the crosshair, not the Atlas's own start
  expect(await centreCell(page)).toEqual({ lat: 44.41, lon: 8.93 });
  await expect(page.locator("[data-atlas-readout]")).toContainText("44,4");
  const first = asked.find((u) => new URL(u).pathname === "/api/atlas/point")!;
  expect(Object.fromEntries(new URL(first).searchParams)).toMatchObject({ lat: "44.41", lon: "8.93", mock: "rain", at: "09:00" });
});

test("two stops a second apart are asked for no closer than the least interval, and the last one is the one asked for", async ({ page }) => {
  await openAtlas(page);
  const times: { t: number; lat: number; lon: number }[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname === "/api/atlas/point") times.push({ t: Date.now(), lat: Number(u.searchParams.get("lat")), lon: Number(u.searchParams.get("lon")) });
  });
  await page.mouse.move(500, 400);
  await page.mouse.down();
  await page.mouse.move(540, 420);
  await page.mouse.up();
  // the first stop is asked for once its quiet is over (a second drag inside the quiet would cancel it)
  await expect.poll(() => times.length, { timeout: 15_000 }).toBe(1);
  // and a second stop follows within the interval
  await page.mouse.move(500, 400);
  await page.mouse.down();
  await page.mouse.move(430, 380);
  await page.mouse.up();
  await expect.poll(() => times.length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
  await expect(page.locator("[data-atlas-point]")).toHaveAttribute("data-phase", "resting", { timeout: 15_000 });
  expect(times[1].t - times[0].t).toBeGreaterThanOrEqual(1900);
  expect({ lat: times.at(-1)!.lat, lon: times.at(-1)!.lon }).toEqual(await centreCell(page));
});

test("a point that does not arrive leaves the previous one on show, says so, and Riprova asks for it again", async ({ page }) => {
  await openAtlas(page);
  const before = await page.locator("[data-atlas-point-reading]").textContent();
  await page.waitForTimeout(1200);
  const skyBefore = await skyVar(page);
  await page.route("**/api/atlas/point*", (route) => route.fulfill({ status: 502, contentType: "application/json", body: '{"error":"x"}' }));
  await page.mouse.move(500, 400);
  await page.mouse.down();
  await page.mouse.move(380, 330, { steps: 8 });
  await page.mouse.up();
  // a zoom that would re-tint the sky, on a stop whose point does not arrive
  await page.mouse.wheel(0, -600);
  const box = page.locator("[data-atlas-point]");
  await expect(box).toHaveAttribute("data-phase", "failed", { timeout: 15_000 });
  await page.waitForTimeout(1200);
  expect(await skyVar(page)).toBe(skyBefore);
  await expect(box).toContainText("Non aggiornato");
  await expect(box).toContainText("Il meteo di questo punto non è arrivato.");
  // the previous point is still the one on show
  await expect(page.locator("[data-atlas-point-reading]")).toHaveText(before!);
  await expect(page.locator("[data-atlas-map]")).toHaveAttribute("data-map-creations", "1");
  await page.unroute("**/api/atlas/point*");
  await page.getByRole("button", { name: "Riprova" }).click();
  await expect(box).toHaveAttribute("data-phase", "resting", { timeout: 15_000 });
  await expect(box).not.toContainText("Non aggiornato");
  await expect(page).toHaveURL(new RegExp(`lat=${(await centreCell(page)).lat}`));
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

test("the centre's coordinates never sit over Mapbox's logo or attribution", async ({ page }) => {
  await openAtlas(page);
  const overlaps = await page.evaluate(() => {
    const r = document.querySelector("[data-atlas-readout]")!.parentElement!.getBoundingClientRect();
    return [".mapboxgl-ctrl-logo", ".mapboxgl-ctrl-attrib"].flatMap((q) =>
      [...document.querySelectorAll(q)].map((el) => el.getBoundingClientRect()).filter((b) => b.width > 0 && !(b.right <= r.left || b.left >= r.right || b.bottom <= r.top || b.top >= r.bottom)),
    ).length;
  });
  expect(overlaps).toBe(0);
});

const skyVar = (page: import("@playwright/test").Page, name = "--sky-1") =>
  page.locator("[data-atlas]").evaluate((el, n) => (el as HTMLElement).style.getPropertyValue(n), name);

test("the sky follows the weather of the point on show: a night is not a morning, and it is not the neutral sky", async ({ page }) => {
  await openAtlas(page);
  const neutral = await skyVar(page);
  const day = await (async () => {
    await page.goto("/atlas?mock=clear&at=12:00");
    await expect(page.locator("[data-atlas-point-reading]")).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => skyVar(page), { timeout: 10_000 }).not.toBe(neutral);
    return skyVar(page);
  })();
  await page.goto("/atlas?mock=clear&at=02:00");
  await expect(page.locator("[data-atlas-point-reading]")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => skyVar(page), { timeout: 10_000 }).not.toBe(neutral);
  const night = await skyVar(page);
  expect(night).not.toBe(day);
});

test("the sky stays the previous one while the map moves, and the zoom sets how local it is once the map stops", async ({ page }) => {
  await page.goto("/atlas?mock=heavy-rain&at=02:00");
  await expect(page.locator("[data-atlas-point-reading]")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-atlas-point]")).toHaveAttribute("data-phase", "resting", { timeout: 15_000 });
  await page.waitForFunction(() => !!window.__atlas);
  // the sky has settled on the point's (the page's own dissolve is a second long)
  await page.waitForTimeout(1200);
  const far = await skyVar(page);

  // While the map moves (the button held down, zooming with the wheel) the sky is the one it was
  await page.mouse.move(500, 400);
  await page.mouse.down();
  await page.mouse.move(520, 410);
  await page.mouse.wheel(0, -900);
  await page.waitForTimeout(700);
  expect(await skyVar(page)).toBe(far);
  await page.mouse.up();

  // and once it has stopped, closer, the sky is more the point's own
  await expect.poll(() => skyVar(page), { timeout: 15_000 }).not.toBe(far);
  const zoomed = await zoom(page);
  expect(zoomed).toBeGreaterThan(8.5);
  const close = await skyVar(page);

  // farther again: back towards the neutral sky, the same sky as at the same zoom before
  await page.mouse.wheel(0, 1800);
  await expect.poll(() => zoom(page), { timeout: 15_000 }).toBeLessThan(zoomed - 0.5);
  await movementEnded(page);
  await expect.poll(() => skyVar(page), { timeout: 15_000 }).not.toBe(close);
});

test("the home page is not the Atlas, and the Atlas is not offered to search engines", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-atlas]")).toHaveCount(0);
  await expect(page.locator("canvas.mapboxgl-canvas")).toHaveCount(0);
  await page.goto("/atlas");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
