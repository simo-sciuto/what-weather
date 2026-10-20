import { expect, test } from "@playwright/test";
import { centrePoint } from "../src/lib/atlas/center";
import { centre, centreCell, crosshairAndMapCentres, fieldRequests, movementEnded, openAtlas, pointRequests, recordRequests, strayRequests, zoom } from "./atlas-helpers";

/*
 * The atlas at / (ADR-030), M3 and M4: a free map and the weather of the point it rests on. These tests check its structure and its
 * behaviour (the map is made once and stays, the gestures move it, the crosshair stays, nothing renders for a frame,
 * nothing is asked for while the map moves and one request follows a stop), with the map drawn over an empty style and
 * the sample weather behind the point route. They do not judge the look: that is the user's, with the real Mapbox, in a browser.
 */

test("opens on a free map: the crosshair, the centre's coordinates, Mapbox's attribution and the way back", async ({ page }) => {
  await openAtlas(page);
  await expect(page).toHaveTitle(/Atlante del meteo/);
  await expect(page.locator("canvas.mapboxgl-canvas")).toHaveCount(1);
  await expect(page.locator("[data-atlas-crosshair]")).toBeVisible();
  await expect(page.locator("[data-atlas-readout]")).toHaveText("45,0700° N · 7,6870° E");
  await expect(page.locator(".mapboxgl-ctrl-attrib")).toBeVisible();
  await expect(page.locator(".mapboxgl-ctrl-logo")).toBeVisible();
  // the site's name starts again: the atlas with nothing chosen
  await expect(page.getByRole("link", { name: "what-weather" })).toHaveAttribute("href", "/");
  await expect(page.getByRole("heading", { name: "Atlante del meteo" })).toBeAttached();
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
    ["replace('/?x=1')", "x=1"],
    ["push('/?x=2&y=3')", "x=2&y=3"],
    ["back()", "x=1"],
  ] as const) {
    await page.evaluate(`window.next.router.${go}`);
    await expect(query).toHaveAttribute("data-atlas-route-query", expected);
    await expect(box).toHaveAttribute("data-map-creations", "1");
    await expect(page.locator("canvas.mapboxgl-canvas[data-first=yes]")).toHaveCount(1);
    expect(await page.evaluate(() => (window.__atlas!.map as unknown as { __first?: boolean }).__first)).toBe(true);
  }

  // A change of page, not only of the address's parameters: another page inside the same layout, and back
  await page.evaluate("window.next.router.push('/persistence-check')");
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
  await expect(page).toHaveURL(/\/\?lat=45\.07&lon=7\.69/);
  await expect(page.locator("[data-atlas-map]")).toHaveAttribute("data-map-creations", "1");
});

test("an address that names a point opens the map and the weather on that point, and carries the sample weather's parameters on", async ({ page }) => {
  const asked: string[] = [];
  page.on("request", (r) => asked.push(r.url()));
  await page.goto("/?lat=44.41&lon=8.93&mock=rain&at=09:00");
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
  for (let i = 0; i < 8 && !wordmark; i++) {
    await page.keyboard.press("Tab");
    const f = await focused();
    if (f.tag === "A") {
      expect(f.style).toBe("solid");
      expect(f.width).toBeGreaterThanOrEqual(2);
      expect(f.color).not.toBe("rgb(16, 16, 16)");
    }
    // the last stop is the wordmark, which starts the atlas again
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
    await page.goto("/?mock=clear&at=12:00");
    await expect(page.locator("[data-atlas-point-reading]")).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => skyVar(page), { timeout: 10_000 }).not.toBe(neutral);
    return skyVar(page);
  })();
  await page.goto("/?mock=clear&at=02:00");
  await expect(page.locator("[data-atlas-point-reading]")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => skyVar(page), { timeout: 10_000 }).not.toBe(neutral);
  const night = await skyVar(page);
  expect(night).not.toBe(day);
});

test("the sky stays the previous one while the map moves, and the zoom sets how local it is once the map stops", async ({ page }) => {
  await page.goto("/?mock=heavy-rain&at=02:00");
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

test("the place's name is as precise as the zoom, and zooming asks for nothing more", async ({ page }) => {
  // The test build has no Mapbox token, so no geocoder: the point route is answered with a place added to its own answer
  await page.route("**/api/atlas/point*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { ...body, place: { country: "Italia", region: "Piemonte", place: "Torino", locality: "Borgo Vanchiglia", nearKm: 0.3 } } });
  });
  const asked: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/atlas/point") asked.push(r.url());
  });
  await openAtlas(page);
  const name = page.locator("[data-atlas-place]");
  const jump = (zoomTo: number) => page.evaluate((z) => window.__atlas!.port.jumpTo({ zoom: z }), zoomTo);
  const nameAt = async (z: number) => {
    await jump(z);
    await movementEnded(page);
    return name;
  };

  await expect(await nameAt(3)).toContainText("Italia");
  await expect(await nameAt(6)).toContainText("Piemonte");
  await expect(await nameAt(9.5)).toContainText("Torino");
  await expect(name).toContainText("Piemonte");
  // close: the town and the quarter under it, at one size, the town heavier
  await expect(await nameAt(12)).toContainText("Borgo Vanchiglia");
  await expect(page.locator("[data-atlas-place-name]")).toHaveText("Torino");
  await expect(page.locator("[data-atlas-place-detail]")).toHaveText("Borgo Vanchiglia");
  const sizes = await page.evaluate(() => {
    const css = (sel: string) => getComputedStyle(document.querySelector(sel)!);
    return { name: css("[data-atlas-place-name]").fontSize, detail: css("[data-atlas-place-detail]").fontSize, nameWeight: css("[data-atlas-place-name]").fontWeight, detailWeight: css("[data-atlas-place-detail]").fontWeight };
  });
  expect(sizes.detail).toBe(sizes.name);
  expect(Number(sizes.nameWeight)).toBeGreaterThan(Number(sizes.detailWeight));
  await expect(name).not.toContainText("Vicino a");
  // back out: the same point, named coarser again; and in all of it one request, the opening one
  await expect(await nameAt(6)).toContainText("Piemonte");
  expect(asked).toHaveLength(1);
  // a screen reader is told the name with the point
  await expect(page.locator("[data-atlas-point] [aria-live]")).toContainText(/Punto caricato: .*Piemonte|Punto caricato: .*Torino|Punto caricato: .*Italia/);
});

test("a name far from the cell is the nearest place, and says so", async ({ page }) => {
  await page.route("**/api/atlas/point*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { ...body, place: { country: "Italia", region: "Valle d'Aosta", place: "Courmayeur", nearKm: 8.2 } } });
  });
  await openAtlas(page);
  await page.evaluate(() => window.__atlas!.port.jumpTo({ zoom: 10 }));
  await movementEnded(page);
  await expect(page.locator("[data-atlas-place]")).toContainText("Vicino a");
  await expect(page.locator("[data-atlas-place]")).toContainText("Courmayeur");
});

test("with no name to give (no token, the open sea) the reading is the weather and the coordinates, as before", async ({ page }) => {
  await openAtlas(page);
  await expect(page.locator("[data-atlas-place]")).toHaveCount(0);
  await expect(page.locator("[data-atlas-point-reading]")).toBeVisible();
});

const ROMA = { name: "Roma", region: "Lazio", country: "IT", lat: 41.89, lon: 12.48 };
const searchFor = async (page: import("@playwright/test").Page, text: string) => {
  await page.getByRole("button", { name: "Cerca una località" }).click();
  const field = page.getByRole("combobox", { name: "Cerca località" });
  await field.fill(text);
  return field;
};
const programMoves = (page: import("@playwright/test").Page) =>
  page.evaluate(() => window.__atlas!.events.filter((e) => e.origin === "program" && e.type === "movestart").length);

test("choosing a searched city starts the flight at once, asks for its point, and pushes the address", async ({ page }) => {
  await page.route("**/api/places?*", (route) => route.fulfill({ json: { places: [ROMA] } }));
  await openAtlas(page);
  const asked: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/atlas/point") asked.push(r.url());
  });
  const historyBefore = await page.evaluate(() => history.length);
  const field = await searchFor(page, "rom");
  await expect(page.getByRole("option", { name: /Roma/ })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("1 località trovata");
  await field.press("Enter");

  // the flight began with the choice, not after the weather: the code's own move, within a moment
  await expect.poll(() => programMoves(page), { timeout: 1000 }).toBeGreaterThan(0);
  expect(await centreCell(page)).not.toEqual({ lat: 41.89, lon: 12.48 });
  await expect(page.getByRole("button", { name: "Cerca una località" })).toBeFocused();

  // and the map lands on the city, at the zoom the town is named at
  await expect.poll(async () => (await centre(page)).lat, { timeout: 15_000 }).toBeCloseTo(41.89, 1);
  await movementEnded(page);
  expect((await centre(page)).lng).toBeCloseTo(12.48, 1);
  expect(await zoom(page)).toBeCloseTo(10.5, 1);
  await expect(page.locator("[data-atlas-point]")).toContainText("41,89° N · 12,48° E", { timeout: 15_000 });
  await expect(page.locator("[data-atlas-point]")).toHaveAttribute("data-phase", "resting");
  await expect(page).toHaveURL(/lat=41\.89&lon=12\.48/);
  // a push, not a replace: Back is the place the person was at
  expect(await page.evaluate(() => history.length)).toBe(historyBefore + 1);
  // the point of the city was asked for once, when it was chosen, and the flight asked for nothing more
  expect(asked.filter((u) => u.includes("lat=41.89"))).toHaveLength(1);
  await expect(page.locator("[data-atlas-map]")).toHaveAttribute("data-map-creations", "1");
});

test("Enter before the results have come takes the first one as soon as it is known", async ({ page }) => {
  await page.route("**/api/places?*", async (route) => {
    await new Promise((r) => setTimeout(r, 700));
    await route.fulfill({ json: { places: [ROMA] } });
  });
  await openAtlas(page);
  const field = await searchFor(page, "roma");
  await field.press("Enter");
  expect(await programMoves(page)).toBe(0);
  await expect.poll(() => programMoves(page), { timeout: 5000 }).toBeGreaterThan(0);
  await expect.poll(async () => (await centre(page)).lat, { timeout: 15_000 }).toBeCloseTo(41.89, 1);
});

test("a person who prefers less motion gets a jump, not a flight", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/places?*", (route) => route.fulfill({ json: { places: [ROMA] } }));
  await openAtlas(page);
  const field = await searchFor(page, "rom");
  await expect(page.getByRole("option", { name: /Roma/ })).toBeVisible();
  await field.press("Enter");
  await expect.poll(async () => (await centre(page)).lat, { timeout: 1500 }).toBeCloseTo(41.89, 1);
});

test("the search says when it finds nothing, and Escape closes it and gives the keyboard back", async ({ page }) => {
  await page.route("**/api/places?*", (route) => route.fulfill({ json: { places: [] } }));
  await openAtlas(page);
  const field = await searchFor(page, "zzzz");
  await expect(page.getByRole("status")).toHaveText("Località non trovata. Prova con un altro nome.");
  expect(await programMoves(page)).toBe(0);
  await field.press("Escape");
  await field.press("Escape");
  await expect(page.getByRole("button", { name: "Cerca una località" })).toBeFocused();
});

test("the home page's map controls are in the Atlas: tint, intensity, contrast and what to show, in the same stores", async ({ page }) => {
  await openAtlas(page);
  const open = page.getByRole("button", { name: "La mappa: colori e strati" });
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await open.click();
  const panel = page.getByRole("dialog", { name: "La mappa" });
  await expect(panel).toBeVisible();
  for (const name of ["Tinta", "Intensità", "Contrasto"]) await expect(panel.getByLabel(name)).toBeVisible();
  for (const group of ["La città", "Da aggiungere", "Mezzi pubblici"]) await expect(panel.getByRole("group", { name: group })).toBeVisible();

  // a slider writes the viewer's tuning, the one the home page reads
  await panel.getByLabel("Tinta").fill("120");
  await panel.getByLabel("Contrasto").fill("80");
  const tuning = await page.evaluate(() => JSON.parse(localStorage.getItem("weather:map-hue")!));
  expect(tuning).toEqual({ hue: 120, vivid: 50, contrast: 80 });

  // a layer chip writes the choice of layers, and says what it is on
  const buildings = panel.getByRole("button", { name: "Edifici", exact: true });
  await expect(buildings).toHaveAttribute("aria-pressed", "false");
  await buildings.click();
  await expect(buildings).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("weather:map-layers")!))).toContain("buildings");

  // the map is the same map: changing its colours does not make it again
  await expect(page.locator("[data-atlas-map]")).toHaveAttribute("data-map-creations", "1");
  await expect(page.locator("canvas.mapboxgl-canvas")).toHaveCount(1);

  // back to the automatic ones
  await panel.getByRole("button", { name: "Torna agli automatici" }).click();
  expect(await page.evaluate(() => [localStorage.getItem("weather:map-hue"), localStorage.getItem("weather:map-layers")])).toEqual([null, null]);
  await expect(buildings).toHaveAttribute("aria-pressed", "false");

  // Escape closes it and the keyboard goes back to the button
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(open).toBeFocused();
});

test("what the viewer chose on the map is still chosen after a reload, and nothing in the panel moves the map", async ({ page }) => {
  await openAtlas(page);
  const before = await centre(page);
  await page.getByRole("button", { name: "La mappa: colori e strati" }).click();
  const panel = page.getByRole("dialog", { name: "La mappa" });
  await panel.getByLabel("Intensità").fill("90");
  expect(await centre(page)).toEqual(before);
  await page.reload();
  await page.waitForFunction(() => !!window.__atlas);
  await page.getByRole("button", { name: "La mappa: colori e strati" }).click();
  await expect(page.getByRole("dialog", { name: "La mappa" }).getByLabel("Intensità")).toHaveValue("90");
});

test("an Enter that found nothing does not make the next search fly, and the search puts the map panel away", async ({ page }) => {
  await page.route("**/api/places?*", (route) => route.fulfill({ json: { places: new URL(route.request().url()).searchParams.get("q") === "zzzz" ? [] : [ROMA] } }));
  await openAtlas(page);
  await page.getByRole("button", { name: "La mappa: colori e strati" }).click();
  await expect(page.getByRole("dialog", { name: "La mappa" })).toBeVisible();
  const field = await searchFor(page, "zzzz");
  // opening the search put the panel away: the results would hang over it
  await expect(page.getByRole("dialog", { name: "La mappa" })).toHaveCount(0);
  await field.press("Enter");
  await expect(page.getByRole("status")).toHaveText("Località non trovata. Prova con un altro nome.");
  await field.fill("");
  await field.fill("rom");
  await expect(page.getByRole("option", { name: /Roma/ })).toBeVisible();
  // no Enter was pressed for this query: nothing flew
  await page.waitForTimeout(600);
  expect(await programMoves(page)).toBe(0);
});

test("the address is pushed only for the city that was searched for: a later stop replaces it", async ({ page }) => {
  await page.route("**/api/places?*", (route) => route.fulfill({ json: { places: [ROMA] } }));
  await openAtlas(page);
  const flyToRoma = async () => {
    const field = await searchFor(page, "rom");
    await expect(page.getByRole("option", { name: /Roma/ })).toBeVisible();
    await field.press("Enter");
  };
  await flyToRoma();
  await expect(page.locator("[data-atlas-point]")).toContainText("41,89° N · 12,48° E", { timeout: 15_000 });
  await movementEnded(page);
  await expect(page.locator("[data-atlas-point]")).toHaveAttribute("data-phase", "resting");
  const length = await page.evaluate(() => history.length);
  // the same city again: no point is asked for, so none arrives to be pushed...
  await flyToRoma();
  await movementEnded(page);
  await page.waitForTimeout(800);
  // ...and the next stop, somewhere else, is a replace, not a new entry in the history
  await page.mouse.move(500, 400);
  await page.mouse.down();
  await page.mouse.move(380, 330, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator("[data-atlas-point]")).not.toContainText("41,89° N · 12,48° E", { timeout: 15_000 });
  await expect(page.locator("[data-atlas-point]")).toHaveAttribute("data-phase", "resting");
  expect(await page.evaluate(() => history.length)).toBe(length);
});

const fieldPixel = (page: import("@playwright/test").Page, x: number, y: number) =>
  page.evaluate(([px, py]) => Array.from(window.__atlasField!.canvas.getContext("2d")!.getImageData(px, py, 1, 1).data), [x, y]);

test("the weather field is under the map's lines, in the colours of the weather of different places, and says what it is", async ({ page }) => {
  const seen = recordRequests(page);
  await openAtlas(page);
  // under every line of the map: its layer is the first of the style
  const order = await page.evaluate(() => (window.__atlas!.map as unknown as { getStyle: () => { layers: { id: string }[] } }).getStyle().layers.map((l) => l.id));
  expect(order[0]).toBe("atlas-weather-field");
  // and lightly over them all, so the roads and the water take the colour of the weather of their place
  expect(order.at(-1)).toBe("atlas-weather-tint");
  expect(fieldRequests(seen.urls)).toHaveLength(1);
  // the sample field is cooler to the north and cloudy in the west: the four corners are not one colour, and it fades between them
  const { width, height } = await page.evaluate(() => ({ width: window.__atlasField!.canvas.width, height: window.__atlasField!.canvas.height }));
  const [nw, ne, sw, se, mid] = await Promise.all([fieldPixel(page, 2, 2), fieldPixel(page, width - 3, 2), fieldPixel(page, 2, height - 3), fieldPixel(page, width - 3, height - 3), fieldPixel(page, width / 2, height / 2)]);
  const apart = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  expect(apart(nw, se)).toBeGreaterThan(20);
  expect(apart(nw, ne)).toBeGreaterThan(8);
  expect(apart(nw, sw)).toBeGreaterThan(8);
  // the middle is between the corners, not one of them: the colours fade, they do not step
  expect(apart(mid, nw)).toBeGreaterThan(3);
  expect(apart(mid, se)).toBeGreaterThan(3);
  expect(nw[3]).toBe(255);
  // and a line says what the colours are and how far apart the places are
  const note = page.locator("[data-atlas-field-note]");
  await expect(note).toContainText("Dati di esempio");
  await expect(note).toContainText("modello, sfumato tra punti a circa");
  await expect(note).toContainText("km");
});

test("the field is asked for once on opening, never while the map moves, and again only when a stop needs other places", async ({ page }) => {
  const seen = recordRequests(page);
  await openAtlas(page);
  expect(fieldRequests(seen.urls)).toHaveLength(1);
  // held still with the button down, well beyond the quiet: nothing
  await page.mouse.move(500, 400);
  await page.mouse.down();
  await page.mouse.move(520, 410, { steps: 4 });
  await page.waitForTimeout(1500);
  expect(fieldRequests(seen.urls)).toHaveLength(1);
  await page.mouse.up();
  // a small nudge: the same places, so the same field, and no request
  await movementEnded(page);
  await page.waitForTimeout(3000);
  expect(fieldRequests(seen.urls)).toHaveLength(1);
  // to another country at another zoom: other places, one more request, and a new drawing
  const draws = await page.evaluate(() => window.__atlasField!.draws);
  await page.evaluate(() => window.__atlas!.port.jumpTo({ lng: -3.7, lat: 40.4, zoom: 5 }));
  await expect.poll(() => fieldRequests(seen.urls).length, { timeout: 15_000 }).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__atlasField!.draws), { timeout: 15_000 }).toBeGreaterThan(draws);
  // the point's own weather is still its own business: one request for the point of each stop
  await expect(page.locator("[data-atlas-point]")).toHaveAttribute("data-phase", "resting", { timeout: 15_000 });
  await expect(page.locator("[data-atlas-map]")).toHaveAttribute("data-map-creations", "1");
});

test("a field that cannot be had leaves the map as it is, with no layer and no note", async ({ page }) => {
  await page.route("**/api/atlas/field*", (route) => route.fulfill({ status: 502, contentType: "application/json", body: '{"error":"x"}' }));
  await page.goto("/");
  await expect(page.locator("[data-atlas-map]")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  await expect(page.locator("[data-atlas-point-reading]")).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => !!window.__atlasField)).toBe(false);
  expect(await page.evaluate(() => (window.__atlas!.map as unknown as { getLayer: (id: string) => unknown }).getLayer("atlas-weather-field"))).toBeUndefined();
  await expect(page.locator("[data-atlas-field-note]")).toHaveCount(0);
  await expect(page.locator("canvas.mapboxgl-canvas")).toHaveCount(1);
});

test("the map's own colours and layers can be changed and the field stays under them", async ({ page }) => {
  await openAtlas(page);
  await page.getByRole("button", { name: "La mappa: colori e strati" }).click();
  await page.getByRole("dialog", { name: "La mappa" }).getByLabel("Tinta").fill("150");
  await page.getByRole("dialog", { name: "La mappa" }).getByRole("button", { name: "Edifici", exact: true }).click();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window.__atlas!.map as unknown as { getStyle: () => { layers: { id: string }[] } }).getStyle().layers[0].id)).toBe("atlas-weather-field");
  await page.getByRole("button", { name: "Torna agli automatici" }).click();
});

test("the home page is the atlas, offered to search engines; the test page is not", async ({ page }) => {
  await openAtlas(page);
  await expect(page.locator("[data-atlas]")).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await page.goto("/persistence-check");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("the time bar moves the reading and the sky over the point's own hours, asks for nothing, and writes the moment into the address", async ({ page }) => {
  await openAtlas(page);
  const asked: string[] = [];
  page.on("request", (r) => asked.push(r.url()));
  const bar = page.locator("[data-atlas-time]");
  await expect(bar).toBeVisible();
  const now = bar.getByRole("button", { name: "Adesso" });
  await expect(now).toHaveAttribute("aria-pressed", "true");
  const slider = bar.getByRole("slider", { name: "Momento" });
  const skyBefore = await page.locator("[data-atlas]").evaluate((el) => getComputedStyle(el).getPropertyValue("--sky-2"));
  // A night twelve hours on: Page Up is a day, the arrows an hour each
  await slider.focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowRight");
  await expect(bar.getByRole("button", { name: "Torna ad adesso" })).toHaveAttribute("aria-pressed", "false");
  await expect(slider).not.toHaveAttribute("aria-valuetext", /^Adesso/);
  await expect(page.locator("[data-atlas-time-label]")).not.toHaveText("Adesso");
  // the reading is the chosen hour's, with its day
  await expect(page.locator("[data-atlas-point]")).toContainText(/ora locale/);
  // and the moment is in the address after a pause, without a request for the point or the field
  await expect.poll(() => new URL(page.url()).searchParams.get("t")).not.toBeNull();
  expect(pointRequests(asked)).toEqual([]);
  expect(asked.filter((u) => new URL(u).pathname.startsWith("/api/atlas/field"))).toEqual([]);
  // the field has the hour too: its colours are that hour's, drawn again without asking
  await expect(page.locator("[data-atlas-field-note]")).not.toContainText("di adesso");
  await expect.poll(() => page.locator("[data-atlas]").evaluate((el) => getComputedStyle(el).getPropertyValue("--sky-2"))).not.toBe(skyBefore);
  // Home is "Adesso" again, and the address loses the moment
  await slider.focus();
  await page.keyboard.press("Home");
  await expect(now).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => new URL(page.url()).searchParams.get("t")).toBeNull();
});

test("an address with a moment opens on that hour; an hour beyond the forecast is said, never shown as another", async ({ page }) => {
  await openAtlas(page);
  const t = Number(await page.locator("[data-atlas-time] input[type=range]").evaluate((el) => (el as HTMLInputElement).max)) > 0;
  expect(t).toBe(true);
  // the first point's hours: take the sixth one from the bar itself
  await page.locator("[data-atlas-time] input[type=range]").focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
  await expect.poll(() => new URL(page.url()).searchParams.get("t")).not.toBeNull();
  const address = page.url();
  const label = await page.locator("[data-atlas-time-label]").textContent();
  await page.goto(address);
  await expect(page.locator("[data-atlas-point-reading]")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-atlas-time-label]")).toHaveText(label ?? "");
  // A year on: no hour answers it, the reading says so and the colours are not another hour's
  const far = new URL(address);
  far.searchParams.set("t", String(Math.floor(Date.now() / 1000) + 300 * 86400));
  await page.goto(far.toString());
  await expect(page.locator("[data-atlas-point-unavailable]")).toContainText("Colori non disponibili per quest'ora", { timeout: 30_000 });
  await expect(page.locator("[data-atlas-field-note]")).toContainText("i colori della mappa sono di adesso");
});

test("three layers, one at a time: the choice is in the address and survives a reload, and the arrows move between them", async ({ page }) => {
  await openAtlas(page);
  const layers = page.locator("[data-atlas-layers]");
  await expect(layers.getByRole("radio")).toHaveCount(3);
  await expect(layers.getByRole("radio", { name: "Meteo" })).toBeChecked();
  await layers.getByText("Territorio").click();
  await expect(layers.getByRole("radio", { name: "Territorio" })).toBeChecked();
  await expect.poll(() => new URL(page.url()).searchParams.get("strato")).toBe("territorio");
  await page.keyboard.press("ArrowRight");
  await expect(layers.getByRole("radio", { name: "Percorsi" })).toBeChecked();
  await expect(page.locator("[data-atlas-layers-note]")).toContainText("I sentieri arrivano presto");
  await page.reload();
  await expect(page.locator("[data-atlas-layers]").getByRole("radio", { name: "Percorsi" })).toBeChecked({ timeout: 30_000 });
  await page.locator("[data-atlas-layers]").getByText("Meteo").click();
  await expect.poll(() => new URL(page.url()).searchParams.get("strato")).toBeNull();
});

test("away from the region Territorio and Percorsi are off, and a line says why", async ({ page }) => {
  await page.route((url) => !["localhost", "127.0.0.1"].includes(url.hostname), (route) => route.abort());
  await page.goto("/?lat=41.9&lon=12.5");
  await expect(page.locator("[data-atlas-point-reading]")).toBeVisible({ timeout: 30_000 });
  const layers = page.locator("[data-atlas-layers]");
  await expect(layers.getByRole("radio", { name: "Territorio" })).toBeDisabled();
  await expect(layers.getByRole("radio", { name: "Percorsi" })).toBeDisabled();
  await expect(page.locator("[data-atlas-layers-note]")).toContainText("per ora Piemonte e Alpi occidentali");
});

test("the old addresses land on the atlas, with their query", async ({ page }) => {
  await page.route((url) => !["localhost", "127.0.0.1"].includes(url.hostname), (route) => route.abort());
  await page.goto("/atlas?lat=44.41&lon=8.93&strato=territorio");
  await expect(page).toHaveURL(/\/\?lat=44\.41&lon=8\.93&strato=territorio/);
  await page.goto("/crea?lat=45.07&lon=7.69");
  await expect(page).toHaveURL(/\/\?lat=45\.07&lon=7\.69/);
  await expect(page.locator("[data-atlas-map]")).toBeAttached();
});

test("the address keeps the point, the moment and the layer together, whatever order they are written in", async ({ page }) => {
  await openAtlas(page);
  await page.locator("[data-atlas-layers]").getByText("Territorio").click();
  await page.locator("[data-atlas-time] input[type=range]").focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  // a stop while the moment waits to be written: the new point, the moment and the layer all end up in the address
  await page.mouse.move(500, 400);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(500 - i * 20, 400 - i * 6);
  await page.mouse.up();
  await movementEnded(page);
  await expect(page.locator("[data-atlas-point]")).toHaveAttribute("data-phase", "resting", { timeout: 15_000 });
  const cell = await centreCell(page);
  await expect.poll(() => {
    const q = new URL(page.url()).searchParams;
    return [q.get("lat"), q.get("lon"), q.get("strato"), q.get("t") !== null];
  }).toEqual([String(cell.lat), String(cell.lon), "territorio", true]);
});

test("Back brings the layer of the address back, and the wordmark starts again at Adesso in Meteo", async ({ page }) => {
  await openAtlas(page);
  await page.locator("[data-atlas-layers]").getByText("Percorsi").click();
  await expect.poll(() => new URL(page.url()).searchParams.get("strato")).toBe("percorsi");
  await page.locator("[data-atlas-time] input[type=range]").focus();
  await page.keyboard.press("End");
  await expect.poll(() => new URL(page.url()).searchParams.get("t")).not.toBeNull();
  await page.getByRole("link", { name: "what-weather" }).click();
  await expect(page.locator("[data-atlas-layers]").getByRole("radio", { name: "Meteo" })).toBeChecked();
  await expect(page.locator("[data-atlas-time]").getByRole("button", { name: "Adesso" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => [new URL(page.url()).searchParams.get("strato"), new URL(page.url()).searchParams.get("t")]).toEqual([null, null]);
});

test("moving the time bar renders neither the shell nor the map, and an hour with no forecast is said as that hour", async ({ page }) => {
  await openAtlas(page);
  const before = await page.evaluate(() => ({ ...window.renders }));
  const slider = page.locator("[data-atlas-time] input[type=range]");
  await slider.focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({ ...window.renders }));
  // the sky of each hour reaches the shell once per hour at most; the point's reading and the bar follow on their own
  expect((after.shell ?? 0) - (before.shell ?? 0)).toBeLessThanOrEqual(22);
  expect((after.crosshair ?? 0) - (before.crosshair ?? 0)).toBe(0);
  expect((after.readout ?? 0) - (before.readout ?? 0)).toBe(0);
  const far = new URL(page.url());
  far.searchParams.set("t", String(Math.floor(Date.now() / 1000) + 300 * 86400));
  await page.goto(far.toString());
  await expect(page.locator("[data-atlas-time] input[type=range]")).toHaveAttribute("aria-valuetext", /^Ora non disponibile: /, { timeout: 30_000 });
  await expect(page.locator("[data-atlas-time-label]")).toContainText("non disponibile");
});
