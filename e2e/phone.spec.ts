import { expect, test } from "@playwright/test";
import { open } from "./helpers";

test("on a phone the page fits the screen and the reading leads", async ({ page }) => {
  await open(page, "clear", "13:00");

  // Nothing widens the page: a phone would let it pan sideways
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  const reading = page.getByRole("region", { name: "Meteo attuale" });
  await expect(reading.getByRole("heading", { level: 1 })).toBeVisible();
  // The three quick facts sit under the reading here, not in a column beside it
  for (const fact of ["Pioggia", "Vento", "Percepita"]) {
    await expect(reading.locator("dt", { hasText: fact })).toBeVisible();
  }
});

test("on a phone the data are in a sheet: put away, then halfway, then high", async ({ page }) => {
  await open(page, "clear", "13:00");
  const sheet = page.locator("#data-sheet");
  await expect(sheet).toHaveAttribute("data-state", "closed");
  await expect(page.getByRole("region", { name: /^Settimana/ })).toBeHidden();

  await page.getByRole("navigation", { name: "Azioni" }).getByRole("button", { name: "Dati" }).click();
  await expect(sheet).toHaveAttribute("data-state", "half");
  await page.getByRole("button", { name: "Alza i dati" }).click();
  await expect(sheet).toHaveAttribute("data-state", "full");
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveAttribute("data-state", "closed");
});

test("on a phone, picking a day brings the sheet down to halfway, the reading above it", async ({ page }) => {
  await open(page, "clear", "08:30");
  await page.getByRole("navigation", { name: "Azioni" }).getByRole("button", { name: "Dati" }).click();
  await page.getByRole("button", { name: "Alza i dati" }).click();
  const tomorrow = page.getByRole("region", { name: /^Settimana/ }).getByRole("button").nth(1);
  await tomorrow.scrollIntoViewIfNeeded();
  await tomorrow.click();
  await expect(page.locator("#data-sheet")).toHaveAttribute("data-state", "half");
  await expect(page.getByRole("region", { name: "Meteo attuale" }).getByRole("heading", { level: 1 })).toBeInViewport();
});
