import { expect, test, type Page } from "@playwright/test";
import { TURIN, open, stubSummaries } from "./helpers";

/*
 * The guide that tells the three sections ("Come funziona"): it plays by itself once, can be seen again from the foot of
 * the page, and gives stills to a person who asked for less motion. The sections themselves are in tavola.spec.ts.
 */

const film = (page: Page) => page.locator("dialog[open] [data-explainer]");
const timeOf = async (page: Page) => Number(await film(page).getAttribute("data-time"));
const openFilm = async (page: Page) => {
  await page.locator("[data-how-it-works]:visible").first().click();
  await expect(film(page)).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  await stubSummaries(page);
});

test("the guide plays by itself the first time, once, and not again", async ({ page }) => {
  await page.goto("/?lat=45.07&lon=7.69&name=Torino", { waitUntil: "commit" });
  await expect(page.locator("dialog[open] [data-explainer]")).toBeVisible({ timeout: 20_000 });
  // it is playing without anyone having pressed anything
  const first = await timeOf(page);
  await page.waitForTimeout(900);
  expect(await timeOf(page)).toBeGreaterThan(first + 400);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  // a second visit does not play it again
  await page.reload();
  await page.waitForTimeout(3500);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});

test("the guide does not start by itself for a person who asked for less motion, nor on a sample sky", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?lat=45.07&lon=7.69&name=Torino", { waitUntil: "commit" });
  await page.waitForTimeout(3500);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await open(page, "clear", "13:00", TURIN);
  await page.waitForTimeout(2500);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});

test("the guide is a plain text at the foot of the page and can be seen again: it plays, pauses, and Escape closes it and gives the keyboard back", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  const button = page.locator("[data-how-it-works]:visible").first();
  await expect(button).toHaveText("Rivedi la guida");
  await openFilm(page);
  await expect(page.getByRole("dialog", { name: "Come funziona" })).toBeVisible();
  const first = await timeOf(page);
  await page.waitForTimeout(900);
  expect(await timeOf(page)).toBeGreaterThan(first + 400);

  await page.locator("[data-explainer-play]").click();
  const paused = await timeOf(page);
  await page.waitForTimeout(700);
  expect(await timeOf(page)).toBe(paused);
  await expect(page.locator("[data-explainer-play]")).toHaveAccessibleName("Riproduci");

  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(button).toBeFocused();
});

test("the three steps of the guide can be jumped to, and the scrub bar moves through it", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  await openFilm(page);
  await page.locator("[data-explainer-play]").click();
  for (const [step, from, to] of [["create", 7000, 11800], ["keep", 11800, 16000], ["explore", 2400, 7000]] as const) {
    await film(page).locator(`[data-step="${step}"]`).click();
    await expect.poll(() => timeOf(page)).toBeGreaterThanOrEqual(from);
    await expect.poll(() => timeOf(page)).toBeLessThan(to + 1500);
    await expect(film(page).locator(`[data-step="${step}"]`)).toHaveAttribute("aria-current", "step");
  }
  await page.locator("[data-explainer-play]").click();
  await film(page).locator("[data-explainer-scrub]").fill("9000");
  expect(await timeOf(page)).toBe(9000);
  await expect(film(page).locator('[data-step="create"]')).toHaveAttribute("aria-current", "step");
});

test("at the end the guide offers two ways in, and the map one leads to the Atlas on that place", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  await openFilm(page);
  await page.locator("[data-explainer-play]").click();
  await film(page).locator("[data-explainer-scrub]").fill("18400");
  const toMap = film(page).getByRole("link", { name: /Esplora la mappa/ });
  await expect(toMap).toBeVisible();
  await expect(film(page).getByRole("link", { name: /Crea un poster/ })).toHaveAttribute("href", /\/crea\?/);
  await expect(film(page).locator("[data-explainer-play]")).toHaveAccessibleName("Rivedi");
  await toMap.click();
  await expect(page).toHaveURL(/\/atlas\?lat=45\.07&lon=7\.69/);
});

test("a person who asked for less motion gets three stills to go through, not a film that plays", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "clear", "13:00", TURIN);
  await openFilm(page);
  await expect(film(page).locator("[data-explainer-play]")).toHaveCount(0);
  await expect(film(page).locator("[data-explainer-scrub]")).toHaveCount(0);
  const still = await timeOf(page);
  await page.waitForTimeout(700);
  expect(await timeOf(page)).toBe(still);
  await film(page).locator('[data-step="keep"]').click();
  expect(await timeOf(page)).toBeGreaterThan(still);
  await expect(film(page).locator('[data-step="keep"]')).toHaveAttribute("aria-current", "step");
});
