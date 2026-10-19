import { expect, test } from "@playwright/test";
import { TURIN, open, stubSummaries } from "./helpers";
import { openAtlas } from "./atlas-helpers";

/*
 * The path Explore, Atlas, Create: from the weather page to the map, from the map to a poster or back to the weather,
 * each step keeping the place. The look of it is the user's to judge; these check that the way is there and goes where it says.
 */

test("from the weather page to the Atlas on the same place, and from the Atlas on to a poster or back", async ({ page }) => {
  await stubSummaries(page);
  await open(page, "clear", "13:00", TURIN);

  // Explore leads to the map, opened on the place on show
  const toMap = page.getByRole("link", { name: /Esplora la mappa/ });
  await expect(toMap).toHaveAttribute("href", "/atlas?lat=45.07&lon=7.69");
  await toMap.click();
  await expect(page).toHaveURL(/\/atlas\?lat=45\.07&lon=7\.69/);
  await expect(page.locator("[data-atlas-point-reading]")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-atlas-point]")).toContainText("45,07° N · 7,69° E");

  // the map leads on: to Create with the place of the point, and back to the weather of it
  const ways = page.locator("[data-atlas-ways]");
  await expect(ways.getByRole("link", { name: /Crea il poster/ })).toHaveAttribute("href", "/crea?lat=45.0700&lon=7.6900");
  await expect(ways.getByRole("link", { name: /Il meteo del luogo/ })).toHaveAttribute("href", "/?lat=45.0700&lon=7.6900");
  await expect(page.getByRole("link", { name: "what-weather" })).toHaveAttribute("href", "/?lat=45.0700&lon=7.6900");
});

test("the Atlas's way to Create opens Create on that place", async ({ page }) => {
  await openAtlas(page);
  await page.locator("[data-atlas-ways]").getByRole("link", { name: /Crea il poster/ }).click();
  await expect(page).toHaveURL(/\/crea\?lat=45\.0700&lon=7\.6900/);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
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
