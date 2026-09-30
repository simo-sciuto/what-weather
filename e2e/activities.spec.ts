import { expect, test } from "@playwright/test";
import { open } from "./helpers";

const NAMES = ["Passeggiata", "Corsa", "Bici", "Trekking"];

test("a fine morning is good for being outside, and says when", async ({ page }) => {
  await open(page, "clear", "08:30");
  const rows = page.getByRole("region", { name: /^Attività/ }).getByRole("listitem");
  await expect(rows).toHaveCount(NAMES.length);
  for (const [i, name] of NAMES.entries()) await expect(rows.nth(i).getByRole("heading")).toHaveText(name);

  await expect(rows.nth(0)).toContainText("Ottime");
  await expect(rows.nth(0)).toContainText(/Meglio adesso, fino alle \d+/);
  await expect(page.getByText(/^Momento migliore: /)).toBeVisible();
});

test("a day of rain is poor for all of them, says why, and names no best hours", async ({ page }) => {
  await open(page, "heavy-rain", "13:00");
  const rows = page.getByRole("region", { name: /^Attività/ }).getByRole("listitem");
  await expect(rows).toHaveCount(NAMES.length);
  for (let i = 0; i < NAMES.length; i++) {
    await expect(rows.nth(i)).toContainText("Scarse");
    await expect(rows.nth(i)).toContainText("Pioggia");
  }
  await expect(page.getByText(/^Momento migliore: /)).toHaveCount(0);
});
