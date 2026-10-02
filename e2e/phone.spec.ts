import { expect, test } from "@playwright/test";
import { open } from "./helpers";

test("on a phone the page fits the screen and the reading leads", async ({ page }) => {
  await open(page, "clear", "13:00");

  // Nothing widens the page: a phone would let it pan sideways
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  const reading = page.getByRole("region", { name: "Meteo attuale" });
  await expect(reading.getByRole("heading", { level: 1 })).toBeVisible();
  // The three quick facts lead the weather sheet, not the poster
  await expect(reading.locator("dt", { hasText: "Vento" })).toHaveCount(0);
  await page.getByRole("navigation", { name: "Pagine" }).getByRole("button", { name: "Meteo" }).click();
  for (const fact of ["Pioggia", "Vento", "Percepita"]) {
    await expect(page.locator("#sheet-data dt", { hasText: fact })).toBeVisible();
  }
});

test("on a phone the data are in a sheet: put away, then halfway, then high", async ({ page }) => {
  await open(page, "clear", "13:00");
  const sheet = page.locator("#sheet-data");
  await expect(sheet).toHaveAttribute("data-state", "closed");
  await expect(page.getByRole("region", { name: /^Settimana/ })).toBeHidden();

  const meteo = page.getByRole("navigation", { name: "Pagine" }).getByRole("button", { name: "Meteo" });
  await meteo.click();
  await expect(sheet).toHaveAttribute("data-state", "half");
  // The bar of pages stays in view, marking the page on show
  await expect(meteo).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Alza meteo" }).click();
  await expect(sheet).toHaveAttribute("data-state", "full");
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveAttribute("data-state", "closed");
  await expect(meteo).not.toHaveAttribute("aria-current", "page");
});

test("on a phone, picking a day brings the sheet down to halfway, the reading above it", async ({ page }) => {
  await open(page, "clear", "08:30");
  await page.getByRole("navigation", { name: "Pagine" }).getByRole("button", { name: "Meteo" }).click();
  await page.getByRole("button", { name: "Alza meteo" }).click();
  const tomorrow = page.getByRole("region", { name: /^Settimana/ }).getByRole("button").nth(1);
  await tomorrow.scrollIntoViewIfNeeded();
  await tomorrow.click();
  await expect(page.locator("#sheet-data")).toHaveAttribute("data-state", "half");
  await expect(page.getByRole("region", { name: "Meteo attuale" }).getByRole("heading", { level: 1 })).toBeInViewport();
});
