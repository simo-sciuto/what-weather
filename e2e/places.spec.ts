import { expect, test } from "@playwright/test";
import { TURIN, hydrated, open, stubSummaries } from "./helpers";

test.beforeEach(async ({ page }) => {
  await stubSummaries(page);
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

test("a saved place stays saved after a reload", async ({ page }) => {
  await open(page, "clear", "13:00");
  const saved = page.getByRole("list", { name: "Città salvate" });
  await expect(saved.getByRole("link")).toHaveCount(0);

  await saved.getByRole("button", { name: "Salva Milano" }).click();
  await expect(saved.getByRole("link", { name: /Milano/ })).toHaveAttribute("aria-current", "location");

  await page.reload({ waitUntil: "commit" });
  await hydrated(page);
  await expect(saved.getByRole("link", { name: /Milano/ })).toBeVisible();
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
