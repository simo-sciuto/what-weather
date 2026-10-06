import { expect, test } from "@playwright/test";
import { TURIN, hydrated, open, stubSummaries } from "./helpers";

// The suite is built without a Mapbox token: there are no maps and so no facts to show, which is the case these
// specs can see without waiting on a service outside. The facts themselves are looked at by hand, with the token.

test.beforeEach(async ({ page }) => {
  await stubSummaries(page);
});

const territory = (path = "") =>
  `/territorio?lat=${TURIN.lat}&lon=${TURIN.lon}&name=${TURIN.name}&mock=clear&at=13:00${path}`;

test("the weather page has no link to the Territorio when there are no maps to read it from", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  await expect(page.getByRole("link", { name: /Territorio/ })).toHaveCount(0);
});

test("the Territorio page is of its place: its name, a way back to its weather, the search", async ({ page }) => {
  await page.goto(territory(), { waitUntil: "commit" });
  await hydrated(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Torino");
  await expect(page.getByRole("combobox", { name: "Cerca località" })).toBeVisible();
  // The way back is the weather of this place, not a city drawn at random
  const back = page.getByRole("link", { name: /Il meteo di Torino/ });
  await expect(back).toHaveAttribute("href", /^\/\?lat=45\.07.*lon=7\.69.*name=Torino/);
  await back.click();
  await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/\?lat=45\.07/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Torino");
});

test("a Territorio without a place goes to the weather page", async ({ page }) => {
  await page.goto("/territorio?mock=clear&at=13:00", { waitUntil: "commit" });
  await expect(page).not.toHaveURL(/territorio/);
});
