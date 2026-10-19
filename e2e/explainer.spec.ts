import { expect, test, type Page } from "@playwright/test";
import { TURIN, open, stubSummaries } from "./helpers";

/*
 * The home as three parts (Explore, Create, Keep) and the guide that tells them ("Come funziona"). The look of it is the
 * user's to judge; these check that the page really is the three (what is under the tabs changes with them, the weather
 * stays), that the guide plays by itself once, can be seen again, and that a person who asked for less motion gets stills.
 */

const film = (page: Page) => page.locator("dialog[open] [data-explainer]");
const timeOf = async (page: Page) => Number(await film(page).getAttribute("data-time"));
const tab = (page: Page, mode: "esplora" | "crea" | "conserva") => page.locator(`[data-mode-tab="${mode}"]:visible`).first();
const openFilm = async (page: Page) => {
  await page.locator("[data-how-it-works]:visible").first().click();
  await expect(film(page)).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  await stubSummaries(page);
});

test("the home is the three parts: tabs at the head of the data, and what is under them changes with them while the weather stays", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  const tabs = page.getByRole("tablist", { name: /scopri, crea, conserva/ }).first();
  await expect(tabs).toBeVisible();
  for (const text of ["Scopro un luogo", "Creo un record", "Conservo il risultato"]) await expect(tabs).toContainText(text);

  // EXPLORE is the page as it was: the hours, the data, and the way into the map
  await expect(tab(page, "esplora")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Prossime 24 ore").first()).toBeVisible();
  await expect(page.locator("[data-explore-card]:visible")).toHaveAttribute("href", "/atlas?lat=45.07&lon=7.69");
  await expect(page.locator("[data-create-panel]")).toBeHidden();
  await expect(page.locator("[data-keep-panel]")).toBeHidden();

  // CREATE: a poster of this moment and the way to make it, the hours still there to choose
  await tab(page, "crea").click();
  await expect(tab(page, "crea")).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/#crea$/);
  await expect(page.locator("[data-create-panel]")).toBeVisible();
  await expect(page.locator("[data-create-panel]")).toContainText("Torino");
  await expect(page.locator("[data-create-link]")).toHaveAttribute("href", /^\/crea\?lat=45\.0700&lon=7\.6900&name=Torino/);
  await expect(page.locator("[data-explore-card]")).toBeHidden();

  // KEEP: the places kept, and the place on show can be kept from here
  await tab(page, "conserva").click();
  await expect(page).toHaveURL(/#conserva$/);
  await expect(page.locator("[data-keep-panel]")).toBeVisible();
  await expect(page.locator("[data-create-panel]")).toBeHidden();
  await page.locator("[data-keep-toggle]").click();
  await expect(page.locator("[data-keep-toggle]")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-keep-panel]").getByRole("list", { name: "Luoghi conservati" })).toContainText("Torino");

  // the weather is the page in all three
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Torino");
  await tab(page, "esplora").click();
  await expect(page.locator("[data-keep-panel]")).toBeHidden();
  await expect(page.getByText("Prossime 24 ore").first()).toBeVisible();
});

test("each of the three can be linked and reloaded: the address says which one the page is in", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  await page.goto("/?lat=45.07&lon=7.69&name=Torino&mock=clear&at=13:00#conserva");
  await expect(page.locator("[data-keep-panel]")).toBeVisible();
  await expect(tab(page, "conserva")).toHaveAttribute("aria-selected", "true");
  await page.reload();
  await expect(page.locator("[data-keep-panel]")).toBeVisible();
});

test("Explore leads to the map on that place", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  await page.locator("[data-explore-card]:visible").click();
  await expect(page).toHaveURL(/\/atlas\?lat=45\.07&lon=7\.69/);
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

test("the guide can be seen again: it plays, pauses, and Escape closes it and gives the keyboard back", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  const button = page.locator("[data-how-it-works]:visible").first();
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

test("on a phone the three parts sit under the search, switch the page's data, and the guide fits the screen", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await open(page, "clear", "13:00", TURIN);
  await expect(tab(page, "esplora")).toBeVisible();
  await expect(tab(page, "crea")).toBeVisible();
  await expect(tab(page, "conserva")).toBeVisible();
  await tab(page, "conserva").click();
  await expect(page).toHaveURL(/#conserva$/);
  await openFilm(page);
  const box = await page.locator("dialog[open]").boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(393);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(393);
});
