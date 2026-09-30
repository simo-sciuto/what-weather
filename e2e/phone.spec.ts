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

test("on a phone, picking a day scrolls back up to the reading", async ({ page }) => {
  await open(page, "clear", "08:30");
  const tomorrow = page.getByRole("region", { name: /^Settimana/ }).getByRole("button").nth(1);
  await tomorrow.scrollIntoViewIfNeeded();
  await tomorrow.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});
