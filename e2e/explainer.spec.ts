import { expect, test, type Page } from "@playwright/test";
import { TURIN, open, stubSummaries } from "./helpers";

/*
 * The home as one page with three stations (Explore, Create, Keep), the bar that runs along its foot, and the guide that
 * tells them ("Come funziona"). The look of it is the user's to judge; these check that the stations are really there,
 * that the path follows the reading and leads to them without touching the address, that the verb of the action is the
 * station's, that the moment is written into the address and read back from it (and said when it cannot be shown), that
 * what is kept is kept on the device, and that the guide plays by itself once, can be seen again, and gives stills to a
 * person who asked for less motion.
 */

const film = (page: Page) => page.locator("dialog[open] [data-explainer]");
const timeOf = async (page: Page) => Number(await film(page).getAttribute("data-time"));
const openFilm = async (page: Page) => {
  await page.locator("[data-how-it-works]:visible").first().click();
  await expect(film(page)).toBeVisible();
};
const bar = (page: Page) => page.locator("[data-bar]");
const path = (page: Page) => bar(page).getByRole("navigation", { name: "Percorso" });
const moment = (page: Page) => bar(page).getByRole("slider", { name: "Momento" });
const station = (page: Page, id: "esplora" | "crea" | "conserva") => page.locator(`section#${id}`);

test.beforeEach(async ({ page }) => {
  await stubSummaries(page);
});

test("the home is three stations in one page, each with its number, its name and a line of what it is for", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  for (const [id, title, sentence] of [
    ["esplora", "01 · Esplora", "Scopri un luogo"],
    ["crea", "02 · Crea", "Crea un record"],
    ["conserva", "03 · Conserva", "Conserva il risultato"],
  ] as const) {
    const section = station(page, id);
    await expect(section).toBeAttached();
    await expect(section.getByRole("heading", { level: 2, name: title })).toBeAttached();
    await expect(section).toContainText(sentence);
  }
  // Explore holds the day's data; the tabs and the old mode switches are gone
  await expect(station(page, "esplora").getByText("Prossime 24 ore").first()).toBeVisible();
  await expect(page.getByRole("tablist")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Torino");
});

test("the path follows the reading by scroll-spy and leads to each station without writing in the address", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  const before = page.url();
  const links = path(page).getByRole("link");
  for (const [i, name] of ["Esplora", "Crea", "Conserva"].entries()) await expect(links.nth(i)).toHaveAccessibleName(name);
  await expect(links.nth(0)).toHaveAttribute("aria-current", "location");
  await expect(links.nth(1)).not.toHaveAttribute("aria-current", "location");

  await links.nth(1).click();
  await expect(links.nth(1)).toHaveAttribute("aria-current", "location");
  await expect(links.nth(0)).not.toHaveAttribute("aria-current", "location");
  await expect(station(page, "crea")).toBeInViewport();
  await expect(station(page, "crea").getByRole("heading", { level: 2 })).toBeFocused();

  await links.nth(2).click();
  await expect(links.nth(2)).toHaveAttribute("aria-current", "location");
  await expect(station(page, "conserva")).toBeInViewport();

  // Scrolling by hand moves it too, back up to Explore
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await expect(links.nth(0)).toHaveAttribute("aria-current", "location");

  // Neither the links nor the spy touched the address
  expect(page.url()).toBe(before);
  expect(page.url()).not.toContain("#");
});

test("the action is the verb of the station: Esplora and Crea are plain links, Conserva keeps the place", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  const action = bar(page).locator("[data-bar-action]");
  await expect(action).toHaveAccessibleName("Esplora la mappa");
  await expect(action).toHaveAttribute("href", "/atlas?lat=45.07&lon=7.69");

  await path(page).getByRole("link", { name: "Crea" }).click();
  await expect(action).toHaveText("Crea");
  await expect(action).toHaveAttribute("href", /^\/crea\?lat=45\.0700&lon=7\.6900&name=Torino/);
  await expect(action).not.toHaveAttribute("href", /[?&]t=/);

  await path(page).getByRole("link", { name: "Conserva" }).click();
  await expect(action).toHaveText("Conserva");
  await expect(action).toHaveAttribute("aria-pressed", "false");
  await expect(station(page, "conserva")).toContainText("Qui compaiono i record che crei. Restano su questo dispositivo.");
});

test("Conserva keeps the place on show as a record of Adesso, shows it in the station, and takes it away", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  await path(page).getByRole("link", { name: "Conserva" }).click();
  const action = bar(page).locator("[data-bar-action]");
  await action.click();
  await expect(action).toHaveAttribute("aria-pressed", "true");
  await expect(action).toHaveText("Conservato");
  await expect(bar(page).locator("[data-bar-said]")).toHaveText("Torino conservato.");

  const records = station(page, "conserva").getByRole("list", { name: "Record conservati" });
  await expect(records.getByRole("listitem")).toHaveCount(1);
  await expect(records).toContainText("Torino");
  await expect(records).toContainText("Adesso");
  await expect(records.getByRole("link", { name: /Rileggi qui/ })).toHaveAttribute("href", /^\/\?lat=45\.0700&lon=7\.6900&name=Torino$/);
  await expect(station(page, "conserva")).toContainText("I record restano su questo dispositivo.");

  // it stays on this device: still there after a reload
  await page.reload({ waitUntil: "commit" });
  await expect(page.locator('[data-bar][data-ready="true"]')).toBeAttached();
  await expect(station(page, "conserva").getByRole("list", { name: "Record conservati" })).toContainText("Torino");

  await station(page, "conserva").getByRole("button", { name: /^Togli/ }).click();
  await expect(station(page, "conserva")).toContainText("Qui compaiono i record che crei.");
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
  const records = station(page, "conserva").getByRole("list", { name: "Record conservati" });
  await expect(records.getByRole("listitem")).toHaveCount(2);
  // the last saved is the newest
  await expect(records.getByRole("listitem").first()).toContainText("Torino");
  await expect(records.getByRole("listitem").nth(1)).toContainText("Roma");
  expect(await page.evaluate(() => window.localStorage.getItem("weather:saved-places"))).toContain("Roma");
  // and the place on show is already kept
  await bar(page).getByRole("navigation", { name: "Percorso" }).getByRole("link", { name: "Conserva" }).click();
  await expect(bar(page).locator("[data-bar-action=\"conserva\"]")).toHaveAttribute("aria-pressed", "true");
  await expect(bar(page).locator("[data-bar-action=\"conserva\"]")).toHaveText("Conservato");
});

test("with many records the last three are shown and the others open in place", async ({ page }) => {
  await page.addInitScript(() => {
    if (window.localStorage.getItem("weather:kept")) return;
    const records = Array.from({ length: 5 }, (_, i) => ({
      id: `r${i}`,
      place: { lat: 40 + i, lon: 10, name: `Luogo ${i + 1}` },
      t: null,
      format: "a4",
      createdAt: 1_790_000_000 + i,
    }));
    window.localStorage.setItem("weather:kept", JSON.stringify({ v: 1, records }));
  });
  await open(page, "clear", "13:00", TURIN);
  const list = station(page, "conserva").getByRole("list", { name: "Record conservati" });
  await expect(list.getByRole("listitem")).toHaveText([/Luogo 5/, /Luogo 4/, /Luogo 3/]);
  const more = station(page, "conserva").getByRole("button", { name: "Tutti i record (5)" });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  await expect(list.getByRole("listitem")).toHaveCount(5);
  await expect(page).toHaveURL(/\/\?lat=45\.07/);
});

test("the moment is written into the address after a pause, and Adesso takes it out", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  await expect(moment(page)).toHaveAttribute("aria-valuetext", /^Adesso, \w{3} \d+ \w{3}, 13:00, ora di Torino/);
  expect(page.url()).not.toMatch(/[?&]t=/);

  await moment(page).focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await expect(moment(page)).toHaveAttribute("aria-valuetext", /16:00, ora di Torino, previsione/);
  await expect.poll(() => page.url()).toMatch(/[?&]t=\d{10}/);
  // the place and the sample sky stay in the address
  expect(page.url()).toContain("name=Torino");
  expect(page.url()).toContain("mock=clear");

  // the Crea action carries the same moment
  await path(page).getByRole("link", { name: "Crea" }).click();
  await expect(bar(page).locator("[data-bar-action]")).toHaveAttribute("href", /[?&]t=\d{10}/);

  await moment(page).focus();
  await page.keyboard.press("Home");
  await expect(moment(page)).toHaveAttribute("aria-valuetext", /^Adesso, /);
  await expect.poll(() => page.url()).not.toMatch(/[?&]t=/);
});

test("PageUp and PageDown move the moment by a day", async ({ page }) => {
  await open(page, "clear", "08:30", TURIN);
  await moment(page).focus();
  await page.keyboard.press("PageUp");
  await expect(moment(page)).toHaveAttribute("aria-valuetext", /^\w{3} \d+ \w{3}, 12:00, ora di Torino, previsione/);
  await page.keyboard.press("PageDown");
  await expect(moment(page)).toHaveAttribute("aria-valuetext", /^Adesso, /);
});

test("an address with the moment opens on it, written on the place's clock", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  await moment(page).focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await expect(moment(page)).toHaveAttribute("aria-valuetext", /16:00, ora di Torino, previsione/);
  await expect.poll(() => page.url()).toMatch(/[?&]t=\d{10}/);
  // only once it has stood still: the address has the hour the track stopped on
  await page.waitForTimeout(700);

  await page.reload({ waitUntil: "commit" });
  await expect(page.locator('[data-bar][data-ready="true"]')).toBeAttached();
  await expect(moment(page)).toHaveAttribute("aria-valuetext", /16:00, ora di Torino, previsione/);
  await expect(page.locator("[data-moment-unavailable]")).toHaveCount(0);
  // the page is at that hour, not at Adesso
  await expect(page.getByRole("heading", { name: "Alle 16:00" })).toBeAttached();
});

test("an hour the forecast does not hold is said, and the page stays on Adesso", async ({ page }) => {
  await page.goto("/?lat=45.07&lon=7.69&name=Torino&mock=clear&at=13:00&t=1800000000", { waitUntil: "commit" });
  await expect(page.locator('[data-bar][data-ready="true"]')).toBeAttached();
  const said = page.locator("[data-moment-unavailable]");
  await expect(said).toContainText("Dato non disponibile per quest'ora");
  await expect(said).toContainText("ora di Torino");
  await expect(moment(page)).toHaveAttribute("aria-valuetext", /^Adesso, /);
  // nothing was put in its place, and the address keeps what it was asked
  expect(page.url()).toContain("t=1800000000");

  // something that is not a moment at all is the same, without an hour to write
  await page.goto("/?lat=45.07&lon=7.69&name=Torino&mock=clear&at=13:00&t=abc", { waitUntil: "commit" });
  await expect(page.locator("[data-moment-unavailable]")).toContainText("Dato non disponibile per quest'ora");
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

test("with less motion the stations are simply there, and the path leads to them at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "clear", "13:00", TURIN);
  await expect(station(page, "conserva")).not.toHaveAttribute("data-enter", /.+/);
  await path(page).getByRole("link", { name: "Conserva" }).click();
  await expect(station(page, "conserva")).toBeInViewport();
  await expect(path(page).getByRole("link", { name: "Conserva" })).toHaveAttribute("aria-current", "location");
});
