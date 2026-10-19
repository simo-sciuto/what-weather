import { expect, test } from "@playwright/test";
import { TURIN, hydrated, open, stubSummaries } from "./helpers";

test.beforeEach(async ({ page }) => {
  await stubSummaries(page);
  // A place chosen in the search has no sample sky in its address, so the guide would play by itself on arriving
  // there (once per browser) and take the keyboard; these tests are about the search, the guide has its own
  await page.addInitScript(() => window.localStorage.setItem("what-weather:guide-seen", "1"));
});

test("searching a place and choosing it opens its weather", async ({ page }) => {
  await page.route("**/api/places?*", (route) => route.fulfill({ json: { places: [TURIN] } }));
  await open(page, "clear", "13:00");

  const search = page.getByRole("combobox", { name: "Cerca località" });
  await search.fill("tor");
  await expect(page.getByRole("option", { name: /Torino/ })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("1 località trovata");
  await search.press("Enter");

  await expect(page).toHaveURL(/lat=45\.07.*lon=7\.69.*name=Torino/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Torino");
  await expect(search).toHaveValue("");
});

test("a search that finds nothing says so", async ({ page }) => {
  await page.route("**/api/places?*", (route) => route.fulfill({ json: { places: [] } }));
  await open(page, "clear", "13:00");
  await page.getByRole("combobox", { name: "Cerca località" }).fill("zzzz");
  await expect(page.getByRole("status")).toHaveText("Località non trovata. Prova con un altro nome.");
});

test("a kept place stays kept after a reload, in the Keep station", async ({ page }) => {
  await open(page, "clear", "13:00");
  const records = page.locator("section#conserva").getByRole("list", { name: "Record conservati" });
  await expect(records).toHaveCount(0);

  await page.getByRole("navigation", { name: "Percorso" }).getByRole("link", { name: "Conserva" }).click();
  await page.locator('[data-bar-action="conserva"]').click();
  await expect(records.getByRole("listitem")).toHaveCount(1);
  await expect(records).toContainText("Milano");

  await page.reload({ waitUntil: "commit" });
  await hydrated(page);
  await expect(records).toContainText("Milano");
});

test("places seen lately are offered in the search, and can be cleared", async ({ page }) => {
  await open(page, "clear", "13:00", TURIN);
  await open(page, "clear", "13:00");

  const search = page.getByRole("combobox", { name: "Cerca località" });
  await search.focus();
  const recent = page.getByRole("list", { name: "Località recenti" });
  // Turin, seen before; not Milan, which is on show
  await expect(recent.getByRole("button")).toHaveText([/Torino/]);

  await recent.getByRole("button", { name: /Torino/ }).click();
  await expect(page).toHaveURL(/name=Torino/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Torino");

  // Now Milan is the one seen before
  await search.focus();
  await expect(recent.getByRole("button")).toHaveText([/Milano/]);
  await page.getByRole("button", { name: "Svuota" }).click();
  await expect(recent).toHaveCount(0);
});
