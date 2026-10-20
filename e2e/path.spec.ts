import { expect, test } from "@playwright/test";
import { TURIN, creaLayer, dock, open, stubSummaries } from "./helpers";
import { openAtlas } from "./atlas-helpers";

/*
 * The path Meteo, Esplora, Crea: from the weather page to the map, from the map to a poster or back to the weather,
 * each step keeping the place. Until the map comes into the page (D6) Esplora is a link to the Atlas and the Atlas has the
 * bar too, with Meteo and Crea as links to the home. The look of it is the user's to judge; these check that the way is
 * there and goes where it says.
 */

test("from the weather page to the Atlas on the same place, and from the Atlas on to a poster or back", async ({ page }) => {
  await stubSummaries(page);
  await open(page, "clear", "13:00", TURIN);

  // Esplora leads to the map, opened on the place on show (the bar's link, a plain one for now)
  const toMap = dock(page).getByRole("link", { name: "Esplora" });
  await expect(toMap).toHaveAttribute("href", /^\/atlas\?lat=45\.0700&lon=7\.6900&name=Torino/);
  await toMap.click();
  await expect(page).toHaveURL(/\/atlas\?lat=45\.0700&lon=7\.6900/);
  await expect(page.locator("[data-atlas-point-reading]")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-atlas-point]")).toContainText("45,07° N · 7,69° E");

  // the map leads on: to Create with the place of the point, and back to the weather of it
  const ways = page.locator("[data-atlas-ways]");
  await expect(ways.getByRole("link", { name: /Crea il poster/ })).toHaveAttribute("href", "/crea?lat=45.0700&lon=7.6900");
  await expect(ways.getByRole("link", { name: /Il meteo del luogo/ })).toHaveAttribute("href", "/?lat=45.0700&lon=7.6900");
  await expect(page.getByRole("link", { name: "what-weather" })).toHaveAttribute("href", "/?lat=45.0700&lon=7.6900");

  // the bar is there on the map too, with Esplora as the current one and the others as links to the home
  await expect(dock(page).getByRole("link", { name: "Esplora" })).toHaveAttribute("aria-current", "page");
  await expect(dock(page).getByRole("link", { name: "Meteo" })).toHaveAttribute("href", "/?lat=45.0700&lon=7.6900");
  await expect(dock(page).getByRole("link", { name: "Crea" })).toHaveAttribute("href", "/?lat=45.0700&lon=7.6900#crea");
});

test("the Atlas's way to Create opens Create on that place", async ({ page }) => {
  await openAtlas(page);
  await page.locator("[data-atlas-ways]").getByRole("link", { name: /Crea il poster/ }).click();
  await expect(page).toHaveURL(/\/crea\?lat=45\.0700&lon=7\.6900/);
  await expect(creaLayer(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("the bar on the map leads to Crea and to Meteo on the point on show", async ({ page }) => {
  await openAtlas(page);
  await dock(page).getByRole("link", { name: "Crea" }).click();
  await expect(page).toHaveURL(/\/\?lat=45\.0700&lon=7\.6900#crea$/);
  await expect(creaLayer(page)).toBeVisible({ timeout: 30_000 });
  await expect(dock(page).getByRole("link", { name: "Crea" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("[data-atlas]")).toHaveCount(0);
});

test("the Atlas's way back opens the weather page on that place", async ({ page }) => {
  await openAtlas(page);
  await page.locator("[data-atlas-ways]").getByRole("link", { name: /Il meteo del luogo/ }).click();
  await expect(page).toHaveURL(/\/\?lat=45\.0700&lon=7\.6900/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-atlas]")).toHaveCount(0);
});

test("a free point with its town far away is not named in the links: the coordinates go alone", async ({ page }) => {
  await page.route("**/api/atlas/point*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { ...body, place: { country: "Italia", region: "Valle d'Aosta", place: "Courmayeur", nearKm: 8.2 } } });
  });
  await openAtlas(page);
  await expect(page.locator("[data-atlas-ways]").getByRole("link", { name: /Crea il poster/ })).toHaveAttribute("href", "/crea?lat=45.0700&lon=7.6900");
});

test("a town the point is in goes into the links by name", async ({ page }) => {
  await page.route("**/api/atlas/point*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { ...body, place: { country: "Italia", place: "Torino", nearKm: 0.4 } } });
  });
  await openAtlas(page);
  await expect(page.locator("[data-atlas-ways]").getByRole("link", { name: /Crea il poster/ })).toHaveAttribute("href", "/crea?lat=45.0700&lon=7.6900&name=Torino");
});
