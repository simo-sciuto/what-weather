import { expect, test } from "@playwright/test";
import { TURIN, open, stubSummaries } from "./helpers";

/*
 * The phone (Pixel 7): the same one page of stations, in one column, with the bar in two rows at its foot. The page
 * scrolls like any page; there are no sheets, no tabs and no bar of icons.
 */

test.beforeEach(async ({ page }) => {
  await stubSummaries(page);
});

test("on a phone the page fits the screen, the reading leads and the facts are in the first station", async ({ page }) => {
  await open(page, "clear", "13:00");

  // Nothing widens the page: a phone would let it pan sideways
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  const reading = page.getByRole("region", { name: "Meteo attuale" });
  await expect(reading.getByRole("heading", { level: 1 })).toBeVisible();
  // The three quick facts lead the Explore station, not the reading
  await expect(reading.locator("dt", { hasText: "Vento" })).toHaveCount(0);
  for (const fact of ["Pioggia", "Vento", "Percepita"]) {
    await expect(page.locator("section#esplora dt", { hasText: fact })).toBeAttached();
  }
  // No sheets and no bar of pages any more
  await expect(page.getByRole("navigation", { name: "Pagine" })).toHaveCount(0);
  await expect(page.locator("#sheet-data")).toHaveCount(0);
});

test("on a phone the page scrolls, and the small headline appears once the large reading has gone", async ({ page }) => {
  await open(page, "clear", "13:00");
  const band = page.locator("[data-headline-band]");
  await expect(band).toHaveAttribute("data-shown", "false");

  await page.locator("section#esplora").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight }));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  await expect(band).toHaveAttribute("data-shown", "true");
  await expect(band).toContainText("Milano");
  const box = (await band.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.height).toBeGreaterThanOrEqual(56);

  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await expect(band).toHaveAttribute("data-shown", "false");
});

test("on a phone the bar has two rows: the moment above, the path with numbers and the action below", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  const bar = page.locator("[data-bar]");
  const box = (await bar.boundingBox())!;
  // 104 px, and the safe area (none in the test browser)
  expect(Math.round(box.height)).toBe(104);
  const viewport = page.viewportSize()!;
  expect(Math.round(box.y + box.height)).toBe(viewport.height);

  const moment = bar.getByRole("slider", { name: "Momento" });
  const links = bar.getByRole("navigation", { name: "Percorso" }).getByRole("link");
  const action = bar.locator("[data-bar-action]");
  // the numbers are only the look: the names are the stations'
  for (const [i, number] of ["01", "02", "03"].entries()) {
    await expect(links.nth(i).locator('span[aria-hidden="true"]').last()).toHaveText(number);
    await expect(links.nth(i)).toHaveAccessibleName(["Esplora", "Crea", "Conserva"][i]);
  }
  await expect(action).toHaveAccessibleName("Esplora");

  const slider = (await moment.boundingBox())!;
  const path = (await links.first().boundingBox())!;
  const button = (await action.boundingBox())!;
  expect(slider.y + slider.height).toBeLessThanOrEqual(path.y + 1);
  // a thumb needs 44 px
  expect(slider.height).toBeGreaterThanOrEqual(44);
  expect(path.width).toBeGreaterThanOrEqual(44);
  expect(path.height).toBeGreaterThanOrEqual(44);
  expect(button.height).toBeGreaterThanOrEqual(44);

  // the path leads to a station and the action follows it
  await links.nth(1).click();
  await expect(links.nth(1)).toHaveAttribute("aria-current", "location");
  await expect(action).toHaveAccessibleName("Crea");
});

test("on a phone, picking a day in the week moves the moment, and the bar says so", async ({ page }) => {
  await open(page, "clear", "08:30", TURIN);
  const tomorrow = page.getByRole("region", { name: /^Settimana/ }).getByRole("button").nth(1);
  await tomorrow.scrollIntoViewIfNeeded();
  await tomorrow.click();
  await expect(tomorrow).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-bar]").getByRole("slider", { name: "Momento" })).toHaveAttribute("aria-valuetext", /12:00, ora di Torino, previsione/);
});
