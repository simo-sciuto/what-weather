import { expect, test } from "@playwright/test";
import { TURIN, creaLayer, dock, hydrated, stubSummaries } from "./helpers";

/*
 * `/crea` is an entry address (ADR-029): the same page as `/`, opened on Crea, on the place in the address or else the
 * default place, never a city drawn at random. It is not offered to search engines and says the canonical page is `/`.
 */

test.beforeEach(async ({ page }) => {
  await stubSummaries(page);
});

test("Create opens on the place in the address, with the bar on Crea and the document's title", async ({ page }) => {
  await page.goto(`/crea?lat=${TURIN.lat}&lon=${TURIN.lon}&name=${TURIN.name}&mock=clear&at=13:00`);
  await hydrated(page);

  await expect(page).toHaveTitle(/^Crea · Torino/);
  await expect(creaLayer(page)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Torino");
  await expect(dock(page).getByRole("link", { name: "Crea" })).toHaveAttribute("aria-current", "page");
  // the way back to the weather is the bar's, not a link that says "go"
  await expect(page.getByRole("link", { name: /Torna al meteo/ })).toHaveCount(0);
  await dock(page).getByRole("link", { name: "Meteo" }).click();
  await expect(creaLayer(page)).toBeHidden();
  expect(new URL(page.url()).pathname).toBe("/crea");
  expect(new URL(page.url()).hash).toBe("#meteo");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Torino");
});

test("Create with no place in the address is the default place, never a random one", async ({ page }) => {
  await page.goto("/crea?mock=clear&at=13:00");
  await hydrated(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Milano");
  // The e2e build has no Mapbox token: the poster says why it is not offered
  await expect(page.getByText("Senza una mappa non si può creare il poster.")).toBeVisible();
});

test("the entry is not offered to search engines and points to the home as its canonical address", async ({ page }) => {
  await page.goto(`/crea?lat=${TURIN.lat}&lon=${TURIN.lon}&name=${TURIN.name}&mock=clear&at=13:00`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(new URL(canonical!, "http://x.test").pathname).toBe("/");
  // the home is as it was
  await page.goto(`/?lat=${TURIN.lat}&lon=${TURIN.lon}&name=${TURIN.name}&mock=clear&at=13:00`);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});

test("the weather page leads to Create for the place on show with the bar", async ({ page }) => {
  await page.goto(`/?lat=${TURIN.lat}&lon=${TURIN.lon}&name=${TURIN.name}&mock=clear&at=13:00`);
  await hydrated(page);

  await expect(page.getByText("Weather, worth looking at")).toBeVisible();
  await dock(page).getByRole("link", { name: "Crea" }).click();
  await expect(creaLayer(page)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Torino");
  expect(page.url()).toContain("lat=45.07");
  expect(new URL(page.url()).hash).toBe("#crea");
});
