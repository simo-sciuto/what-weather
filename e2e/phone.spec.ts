import { expect, test } from "@playwright/test";
import { TURIN, creaLayer, dock, open, stubSummaries } from "./helpers";

/*
 * The phone (Pixel 7): the same one page, in one column, with the glass bar at its foot. The page scrolls like any
 * page; there are no sheets, no tabs and no bar of moments.
 */

test.beforeEach(async ({ page }) => {
  await stubSummaries(page);
});

test("on a phone the page fits the screen, the reading leads and the facts are in Tempo", async ({ page }) => {
  await open(page, "clear", "13:00");

  // Nothing widens the page: a phone would let it pan sideways
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  const reading = page.getByRole("region", { name: "Meteo attuale" });
  await expect(reading.getByRole("heading", { level: 1 })).toBeVisible();
  // The three quick facts lead Tempo, not the reading
  await expect(reading.locator("dt", { hasText: "Vento" })).toHaveCount(0);
  for (const fact of ["Pioggia", "Vento", "Percepita"]) {
    await expect(page.locator("#parte-tempo dt", { hasText: fact })).toBeAttached();
  }
  // No sheets and no bar of pages any more
  await expect(page.getByRole("navigation", { name: "Pagine" })).toHaveCount(0);
  await expect(page.locator("#sheet-data")).toHaveCount(0);
  // Conserva is in the Testata, within reach of the thumb
  const keep = page.getByRole("button", { name: "Conserva" });
  await expect(keep).toBeVisible();
  expect((await keep.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test("on a phone the page scrolls, and the small headline appears once the large reading has gone, with Tempo", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  const band = page.locator("[data-headline-band]");
  await expect(band).toHaveAttribute("data-shown", "false");
  // away from the keyboard and the readers while it is not on show
  await expect(band).toHaveAttribute("inert", "");

  await page.locator("#parte-tempo").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight }));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  await expect(band).toHaveAttribute("data-shown", "true");
  await expect(band).not.toHaveAttribute("inert", /.*/);
  await expect(band).toContainText("Torino");
  // the e2e build has no Mapbox token and Torino's address names no country, so Territorio has nothing and the band holds only Tempo
  await expect(band.getByRole("button")).toHaveText(["Tempo"]);
  const box = (await band.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.height).toBeGreaterThanOrEqual(56);

  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await expect(band).toHaveAttribute("data-shown", "false");
});

test("on a phone the bar is a capsule of 350 x 64 at 12 from the foot, three icons over their names", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  const box = (await dock(page).boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(Math.round(box.width)).toBe(350);
  expect(Math.round(box.height)).toBe(64);
  // max(12, the safe area), none in the test browser
  expect(Math.round(viewport.height - (box.y + box.height))).toBe(12);
  expect(Math.round(box.x + box.width / 2)).toBe(Math.round(viewport.width / 2));

  for (const name of ["Meteo", "Esplora", "Crea"]) {
    const item = dock(page).getByRole("link", { name });
    const area = (await item.boundingBox())!;
    expect(area.width, name).toBeGreaterThanOrEqual(100);
    expect(area.height, name).toBeGreaterThanOrEqual(52);
    const icon = (await item.locator("svg").boundingBox())!;
    const label = (await item.locator(".dock-label").boundingBox())!;
    expect(Math.round(icon.width)).toBe(24);
    // the icon is above the name
    expect(icon.y + icon.height).toBeLessThanOrEqual(label.y + 1);
    expect(await item.locator(".dock-label").evaluate((el) => getComputedStyle(el).fontSize)).toBe("12px");
  }
});

test("on a phone the page ends above the bar, and the bar changes the section", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight }));
  const capsule = (await dock(page).boundingBox())!;
  const guide = (await page.locator("[data-how-it-works]:visible").first().boundingBox())!;
  expect(guide.y + guide.height).toBeLessThanOrEqual(capsule.y);

  await dock(page).getByRole("link", { name: "Crea" }).click();
  await expect(creaLayer(page)).toBeVisible();
  await expect(dock(page).getByRole("link", { name: "Crea" })).toHaveAttribute("aria-current", "page");
  // Crea has its own scroll and also ends above the bar
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("on a phone, picking a day in the week moves the moment", async ({ page }) => {
  await open(page, "clear", "08:30", TURIN);
  const tomorrow = page.getByRole("region", { name: /^Settimana/ }).getByRole("button").nth(1);
  await tomorrow.scrollIntoViewIfNeeded();
  await tomorrow.click();
  await expect(tomorrow).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("slider", { name: "Ora da mostrare" })).toHaveAttribute("aria-valuetext", /^12:00: /);
});
