import { expect, test, type Page } from "@playwright/test";
import { TURIN, creaLayer, dock, hydrated, open, stubSummaries } from "./helpers";

/*
 * The home as one page with three sections (ADR-029): Meteo (the weather: Tempo and Territorio), Crea (the poster and
 * "I tuoi poster") and, for now, Esplora as a link to the Atlas. These check that the bar is the three real links it
 * says, that a switch is one step of the history with the place and the moment kept, that Back and Forward bring the
 * section back, that the focus, the announcement and the title follow a change somebody made, that the entry addresses
 * open the same page on their section, that Conserva keeps on this device, and that the moment is written into the
 * address and read back from it. The look of it is the user's to judge.
 */

const hours = (page: Page) => page.getByRole("slider", { name: "Ora da mostrare" });
const records = (page: Page) => creaLayer(page).getByRole("list", { name: "Record conservati" });
const said = (page: Page) => page.locator("[data-section-said]");
const link = (page: Page, name: string) => dock(page).getByRole("link", { name });

test.beforeEach(async ({ page }) => {
  await stubSummaries(page);
});

test("the bar is a nav of three real links, Meteo is the current one, and Crea is not mounted until it is visited", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  await expect(dock(page).getByRole("link")).toHaveText(["Meteo", "Esplora", "Crea"]);
  // not tabs: sections of a page, with an address
  await expect(page.getByRole("tablist")).toHaveCount(0);
  await expect(link(page, "Meteo")).toHaveAttribute("aria-current", "page");
  await expect(link(page, "Esplora")).not.toHaveAttribute("aria-current", /.+/);
  await expect(link(page, "Crea")).not.toHaveAttribute("aria-current", /.+/);
  // Esplora is a plain link to the Atlas on the place on show (until the map comes into the page)
  await expect(link(page, "Esplora")).toHaveAttribute("href", /^\/atlas\?lat=45\.0700&lon=7\.6900&name=Torino/);
  await expect(creaLayer(page)).toHaveCount(0);
  // the reading leads; Tempo and Territorio are one page, not two tabs
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Torino");
});

test("each link of the bar is at least 44 px, with the glass behind it and not around it", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  for (const name of ["Meteo", "Esplora", "Crea"]) {
    const box = (await link(page, name).boundingBox())!;
    expect(box.width, name).toBeGreaterThanOrEqual(100);
    expect(box.height, name).toBeGreaterThanOrEqual(44);
  }
  const capsule = (await dock(page).boundingBox())!;
  expect(Math.round(capsule.width)).toBe(360);
  expect(Math.round(capsule.height)).toBe(60);
  const viewport = page.viewportSize()!;
  expect(Math.round(viewport.height - (capsule.y + capsule.height))).toBe(24);
  expect(Math.round(capsule.x + capsule.width / 2)).toBe(Math.round(viewport.width / 2));
  // the blur is on a layer of its own, which is neither the bar nor a link: nothing that contains the links filters
  const filters = await page.evaluate(() => {
    const bar = document.querySelector("[data-dock]")!;
    const own = (el: Element) => getComputedStyle(el).backdropFilter;
    return {
      bar: own(bar),
      glass: own(bar.querySelector(".dock-glass")!),
      items: [...bar.querySelectorAll("a")].map(own),
      parentOpacity: getComputedStyle(bar).opacity,
      parentTransform: getComputedStyle(bar).transform,
    };
  });
  expect(filters.glass).toContain("blur(16px)");
  expect(filters.bar).toBe("none");
  expect(filters.items.every((f) => f === "none")).toBe(true);
  expect(filters.parentOpacity).toBe("1");
  expect(filters.parentTransform).toBe("none");
});

test("choosing Crea writes #crea after the query, shows the layer and makes Meteo inert; Meteo goes back", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  const before = new URL(page.url());
  await link(page, "Crea").click();
  await expect(creaLayer(page)).toBeVisible();
  await expect(link(page, "Crea")).toHaveAttribute("aria-current", "page");
  await expect(link(page, "Meteo")).not.toHaveAttribute("aria-current", /.+/);
  const after = new URL(page.url());
  expect(after.hash).toBe("#crea");
  expect(after.pathname + after.search).toBe(before.pathname + before.search);
  // the page behind is neither reachable nor read
  await expect(page.locator('[data-section="meteo"]')).toHaveAttribute("inert", "");
  await expect(page.locator('[data-section="meteo"]')).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Torino");
  await expect(creaLayer(page)).toContainText("Il cielo e la mappa di questo luogo, in questo momento, come un poster.");

  await link(page, "Meteo").click();
  await expect(creaLayer(page)).toBeHidden();
  await expect(link(page, "Meteo")).toHaveAttribute("aria-current", "page");
  expect(new URL(page.url()).hash).toBe("");
  await expect(page.locator('[data-section="meteo"]')).not.toHaveAttribute("inert", /.*/);
  await expect(page.locator('[data-section="meteo"]')).not.toHaveAttribute("aria-hidden", /.+/);
});

test("Back and Forward bring the section back, and Meteo keeps where it was scrolled", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  await page.evaluate(() => window.scrollTo({ top: 600 }));
  const scrolled = await page.evaluate(() => window.scrollY);
  expect(scrolled).toBeGreaterThan(300);

  await link(page, "Crea").click();
  await expect(creaLayer(page)).toBeVisible();
  await page.goBack();
  await expect(creaLayer(page)).toBeHidden();
  await expect(link(page, "Meteo")).toHaveAttribute("aria-current", "page");
  expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);

  await page.goForward();
  await expect(creaLayer(page)).toBeVisible();
  await expect(link(page, "Crea")).toHaveAttribute("aria-current", "page");
  expect(new URL(page.url()).hash).toBe("#crea");
});

test("a reload on #crea opens Crea, and an address with a hash does not take the keyboard", async ({ page }) => {
  await page.goto(`/?lat=${TURIN.lat}&lon=${TURIN.lon}&name=${TURIN.name}&mock=clear&at=13:00#crea`, { waitUntil: "commit" });
  await hydrated(page);
  await expect(creaLayer(page)).toBeVisible();
  await expect(link(page, "Crea")).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Torino");
  // the page opening on its section is not a change somebody made: nothing is announced, the focus is not moved
  await expect(said(page)).toHaveText("");
  await expect(page.locator('h1[data-section-title="crea"]')).not.toBeFocused();
  await expect(page).toHaveTitle("Crea · Torino · what-weather");

  await page.reload({ waitUntil: "commit" });
  await hydrated(page);
  await expect(creaLayer(page)).toBeVisible();
});

test("after a change the focus goes to the new section's title, a line says which, and the document's title follows", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  await expect(page).toHaveTitle(/^Torino \d+° · Sereno$/);
  await link(page, "Crea").click();
  await expect(page.locator('h1[data-section-title="crea"]')).toBeFocused();
  await expect(said(page)).toHaveText("Crea: Torino");
  await expect(page).toHaveTitle("Crea · Torino · what-weather");
  // the page did not jump to make room for the focus
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await link(page, "Meteo").click();
  await expect(page.locator('h1[data-section-title="meteo"]:visible')).toBeFocused();
  await expect(said(page)).toHaveText("Meteo: Torino");
  await expect(page).toHaveTitle("Meteo · Torino · what-weather");

  // Back is a change somebody made too
  await page.goBack();
  await expect(page.locator('h1[data-section-title="crea"]')).toBeFocused();
  await expect(said(page)).toHaveText("Crea: Torino");
});

test("the keyboard reaches the links of the bar and Enter chooses one", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  await link(page, "Crea").focus();
  await page.keyboard.press("Enter");
  await expect(creaLayer(page)).toBeVisible();
  await expect(link(page, "Crea")).toHaveAttribute("aria-current", "page");
});

test("the bar is drawn opaque with more contrast asked for, and in system colours with forced colours", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  const glass = () =>
    page.evaluate(() => {
      const el = document.querySelector(".dock-glass")!;
      const style = getComputedStyle(el);
      return { blur: style.backdropFilter, background: style.backgroundColor + " " + style.backgroundImage, border: style.borderTopColor };
    });
  expect((await glass()).blur).toContain("blur(16px)");

  await page.emulateMedia({ contrast: "more" });
  const more = await glass();
  expect(more.blur).toBe("none");
  expect(more.border).toMatch(/rgba?\(255, 255, 255(, 0\.9)?\)/);

  await page.emulateMedia({ contrast: "no-preference", forcedColors: "active" });
  expect((await glass()).blur).toBe("none");
  await expect(link(page, "Meteo")).toHaveAttribute("aria-current", "page");
  const underline = await link(page, "Meteo").locator(".dock-label").evaluate((el) => getComputedStyle(el).textDecorationLine);
  expect(underline).toBe("underline");
});

test("the room at the foot of the page is the bar's: nothing ends under it", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--dock-room").trim())).toMatch(/^(108px|calc\()/);
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight }));
  const capsule = (await dock(page).boundingBox())!;
  const foot = await page.evaluate(() => [...document.querySelectorAll("[data-guide-foot], [data-how-it-works]")].map((e) => e.getBoundingClientRect().bottom));
  for (const bottom of foot) expect(bottom).toBeLessThanOrEqual(capsule.y);
});

test.describe("Tempo and Territorio", () => {
  test("two titles lead the column; without Territorio there is only Tempo", async ({ page }) => {
    await open(page, "clear", "13:00", TURIN);
    const parts = page.locator('[data-parts-nav="page"]');
    // the e2e build has no Mapbox token, so Territorio has nothing to show: its part and its title are gone
    await expect(parts.getByRole("button")).toHaveText(["Tempo"]);
    await expect(parts.getByRole("button", { name: "Tempo" })).toHaveAttribute("aria-current", "true");
    await expect(page.locator("#parte-territorio")).toBeHidden();
    await expect(page.getByRole("tab")).toHaveCount(0);
    // the day's data are in Tempo
    for (const fact of ["Pioggia", "Vento", "Percepita"]) await expect(page.locator("#parte-tempo dt", { hasText: fact })).toBeAttached();
    await expect(page.locator("#parte-tempo").getByText("Prossime 24 ore").first()).toBeVisible();
  });

  test("the accent line is 3 px under the part being read, and a title leads to its part", async ({ page }) => {
    await open(page, "clear", "13:00", TURIN);
    // Territorio arrives in streaming: here it is put in place by hand, as the page does when it comes
    await page.evaluate(() => {
      const part = document.getElementById("parte-territorio")!;
      const body = document.createElement("div");
      body.style.height = "1400px";
      body.textContent = "Territorio di prova";
      part.append(body);
    });
    const parts = page.locator('[data-parts-nav="page"]');
    await expect(parts.getByRole("button")).toHaveText(["Tempo", "Territorio"]);
    const underline = await parts.getByRole("button", { name: "Tempo" }).evaluate((el) => getComputedStyle(el).borderBottomWidth);
    expect(underline).toBe("3px");

    await parts.getByRole("button", { name: "Territorio" }).click();
    await expect(parts.getByRole("button", { name: "Territorio" })).toHaveAttribute("aria-current", "true");
    await expect(parts.getByRole("button", { name: "Tempo" })).not.toHaveAttribute("aria-current", /.+/);
    await expect(page.locator("#parte-territorio")).toBeInViewport();
    // neither the click nor the spy touched the address
    expect(new URL(page.url()).hash).toBe("");

    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await expect(parts.getByRole("button", { name: "Tempo" })).toHaveAttribute("aria-current", "true");
  });

  test("with less motion a title leads to its part at once", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "clear", "13:00", TURIN);
    await page.evaluate(() => {
      const body = document.createElement("div");
      body.style.height = "1400px";
      document.getElementById("parte-territorio")!.append(body);
    });
    const button = page.locator('[data-parts-nav="page"]').getByRole("button", { name: "Territorio" });
    await expect(button).toBeVisible();
    await button.click();
    // no smooth scroll to wait for: the page is already there when the click returns
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  });
});

test.describe("Conserva", () => {
  test("keeps the place on show from the Testata, shows it in 'I tuoi poster', and takes it away", async ({ page }) => {
    await open(page, "clear", "13:00", TURIN);
    const keep = page.getByRole("button", { name: "Conserva" });
    await expect(keep).toHaveAttribute("aria-pressed", "false");
    await keep.click();
    await expect(keep).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-keep-said]").first()).toHaveText("Torino conservato.");

    await link(page, "Crea").click();
    await expect(creaLayer(page).getByRole("heading", { level: 2, name: "I tuoi poster" })).toBeVisible();
    await expect(records(page).getByRole("listitem")).toHaveCount(1);
    await expect(records(page)).toContainText("Torino");
    await expect(records(page)).toContainText("Adesso");
    await expect(records(page).getByRole("link", { name: /Rileggi qui/ })).toHaveAttribute("href", /^\/\?lat=45\.0700&lon=7\.6900&name=Torino$/);
    await expect(creaLayer(page)).toContainText("I record restano su questo dispositivo.");
    // the same logic beside the title of Crea: the place is already kept
    await expect(creaLayer(page).getByRole("button", { name: "Conserva" })).toHaveAttribute("aria-pressed", "true");

    // it stays on this device: still there after a reload
    await page.reload({ waitUntil: "commit" });
    await hydrated(page);
    await expect(records(page)).toContainText("Torino");

    await creaLayer(page).getByRole("button", { name: /^Togli/ }).click();
    await expect(creaLayer(page)).toContainText("Qui compaiono i record che crei.");
    // the focus did not fall to the page
    await expect(creaLayer(page).getByRole("heading", { level: 2, name: "I tuoi poster" })).toBeFocused();
    await link(page, "Meteo").click();
    await expect(page.getByRole("button", { name: "Conserva" })).toHaveAttribute("aria-pressed", "false");
  });

  test("Conserva in Crea keeps the same place, and pressing it again takes it away", async ({ page }) => {
    await open(page, "clear", "13:00", TURIN);
    await link(page, "Crea").click();
    const keep = creaLayer(page).getByRole("button", { name: "Conserva" });
    await expect(keep).toHaveAttribute("aria-pressed", "false");
    await expect(creaLayer(page)).toContainText("Qui compaiono i record che crei.");
    await keep.click();
    await expect(keep).toHaveAttribute("aria-pressed", "true");
    await expect(records(page).getByRole("listitem")).toHaveCount(1);
    await keep.click();
    await expect(keep).toHaveAttribute("aria-pressed", "false");
    await expect(records(page)).toHaveCount(0);
  });

  test("the places saved before become records of Adesso the first time, and the old list stays where it was", async ({ page }) => {
    await page.addInitScript(() => {
      if (!window.localStorage.getItem("weather:saved-places"))
        window.localStorage.setItem(
          "weather:saved-places",
          JSON.stringify([{ lat: 41.9, lon: 12.5, name: "Roma" }, { lat: 45.07, lon: 7.69, name: "Torino" }]),
        );
    });
    await open(page, "clear", "13:00", TURIN);
    await link(page, "Crea").click();
    await expect(records(page).getByRole("listitem")).toHaveCount(2);
    // the last saved is the newest
    await expect(records(page).getByRole("listitem").first()).toContainText("Torino");
    await expect(records(page).getByRole("listitem").nth(1)).toContainText("Roma");
    expect(await page.evaluate(() => window.localStorage.getItem("weather:saved-places"))).toContain("Roma");
    // and the place on show is already kept
    await expect(creaLayer(page).getByRole("button", { name: "Conserva" })).toHaveAttribute("aria-pressed", "true");
  });

  test("with many records the last three are shown and the others open in place", async ({ page }) => {
    await page.addInitScript(() => {
      if (window.localStorage.getItem("weather:kept")) return;
      const list = Array.from({ length: 5 }, (_, i) => ({
        id: `r${i}`,
        place: { lat: 40 + i, lon: 10, name: `Luogo ${i + 1}` },
        t: null,
        format: "a4",
        createdAt: 1_790_000_000 + i,
      }));
      window.localStorage.setItem("weather:kept", JSON.stringify({ v: 1, records: list }));
    });
    await open(page, "clear", "13:00", TURIN);
    await link(page, "Crea").click();
    await expect(records(page).getByRole("listitem")).toHaveText([/Luogo 5/, /Luogo 4/, /Luogo 3/]);
    const more = creaLayer(page).getByRole("button", { name: "Tutti i record (5)" });
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await more.click();
    await expect(records(page).getByRole("listitem")).toHaveCount(5);
    await expect(page).toHaveURL(/\/\?lat=45\.07.*#crea$/);
  });
});

test.describe("the moment in the address", () => {
  test("the moment is written into the address after a pause, and Adesso takes it out", async ({ page }) => {
    await open(page, "clear", "13:00", TURIN);
    expect(page.url()).not.toMatch(/[?&]t=/);

    await hours(page).focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
    await expect(hours(page)).toHaveAttribute("aria-valuetext", /^16:00: /);
    await expect.poll(() => page.url()).toMatch(/[?&]t=\d{10}/);
    // the place and the sample sky stay in the address
    expect(page.url()).toContain("name=Torino");
    expect(page.url()).toContain("mock=clear");

    // the moment travels with a switch of section: Esplora carries it, Crea shows it
    await expect(link(page, "Esplora")).toHaveAttribute("href", /\/atlas\?.*&t=\d{10}/);
    await link(page, "Crea").click();
    await expect(creaLayer(page).getByText(/^Previsione · .*16:00$/)).toBeVisible();
    await expect(creaLayer(page).getByText(/^Adesso · /)).toHaveCount(0);
    expect(page.url()).toMatch(/[?&]t=\d{10}.*#crea$/);

    await link(page, "Meteo").click();
    await page.getByRole("button", { name: "Torna ad adesso" }).click();
    await expect.poll(() => page.url()).not.toMatch(/[?&]t=/);
    await expect(link(page, "Esplora")).not.toHaveAttribute("href", /[?&]t=/);
  });

  test("an address with the moment opens on it, written on the place's clock", async ({ page }) => {
    await open(page, "clear", "13:00", TURIN);
    await hours(page).focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
    await expect(hours(page)).toHaveAttribute("aria-valuetext", /^16:00: /);
    await expect.poll(() => page.url()).toMatch(/[?&]t=\d{10}/);
    // only once it has stood still: the address has the hour it stopped on
    await page.waitForTimeout(700);

    await page.reload({ waitUntil: "commit" });
    await hydrated(page);
    await expect(hours(page)).toHaveAttribute("aria-valuetext", /^16:00: /);
    await expect(page.locator("[data-moment-unavailable]")).toHaveCount(0);
    // the page is at that hour, not at Adesso
    await expect(page.getByRole("heading", { name: "Alle 16:00" })).toBeAttached();
  });

  test("an hour the forecast does not hold is said, and the page stays on Adesso", async ({ page }) => {
    await page.goto("/?lat=45.07&lon=7.69&name=Torino&mock=clear&at=13:00&t=1800000000", { waitUntil: "commit" });
    await hydrated(page);
    const said = page.locator("[data-moment-unavailable]");
    await expect(said).toContainText("Dato non disponibile per quest'ora");
    await expect(said).toContainText("ora di Torino");
    // nothing was put in its place, and the address keeps what it was asked
    expect(page.url()).toContain("t=1800000000");
    await expect(page.getByRole("heading", { name: "Previsione", exact: true, level: 2 })).toBeAttached();

    // something that is not a moment at all is the same, without an hour to write
    await page.goto("/?lat=45.07&lon=7.69&name=Torino&mock=clear&at=13:00&t=abc", { waitUntil: "commit" });
    await expect(page.locator("[data-moment-unavailable]")).toContainText("Dato non disponibile per quest'ora");
  });
});

test("a place long in name keeps to two lines in the reading, whole in its title", async ({ page }) => {
  await page.goto("/?lat=44.7&lon=11.2&name=San%20Giovanni%20in%20Persiceto%20e%20Sant%27Agata%20Bolognese&mock=clear&at=13:00", { waitUntil: "commit" });
  const title = page.getByRole("heading", { level: 1 }).getByRole("button");
  await expect(title).toHaveAttribute("title", "San Giovanni in Persiceto e Sant'Agata Bolognese");
  const lines = await title.locator("span").first().evaluate((el) => {
    const style = getComputedStyle(el);
    return Math.round(el.getBoundingClientRect().height / parseFloat(style.lineHeight));
  });
  expect(lines).toBeLessThanOrEqual(2);
});
