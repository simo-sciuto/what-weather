import { expect, test } from "@playwright/test";
import { open } from "./helpers";

test("high pollen is brought up the page, with the families in the air", async ({ page }) => {
  await open(page, "windy", "13:00");
  const pollen = page.getByRole("region", { name: "Polline" });
  await expect(pollen).toContainText("Polline alto");
  await expect(pollen).toContainText("Graminacee: alto · erbe infestanti: moderato · alberi: basso");
});

test("with no pollen in the air there is nothing about it", async ({ page }) => {
  await open(page, "clear", "13:00");
  await expect(page.getByRole("heading", { level: 2, name: "Dettagli" })).toBeVisible();
  await expect(page.getByText("Polline")).toHaveCount(0);
});

test("the details are closed until asked for, and the credits stay in view", async ({ page }) => {
  await open(page, "clear", "13:00");
  const details = page.getByRole("button", { name: /^Dettagli/ });
  await expect(details).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("heading", { level: 3, name: "Umidità" })).toHaveCount(0);
  await expect(page.locator("#chapter-map")).toHaveCount(0);
  // Where the data comes from is never put away
  await expect(page.getByText(/^Aggiornato alle/)).toBeVisible();

  await details.click();
  await expect(details).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible();
});
