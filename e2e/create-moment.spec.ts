import { expect, test } from "@playwright/test";
import { open } from "./helpers";

// The moment chosen on Explore reaches Create by its instant (WTH-236). The sample sky is given to Create by the
// test (`mock`, `at`): the link does not carry it, and in production the live forecast needs no such parameters.

test("a forecast hour chosen on Explore opens Create on that hour, marked as a forecast", async ({ page }) => {
  await open(page, "clear", "13:00");
  const hours = page.getByRole("slider", { name: "Ora da mostrare" });
  await hours.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await expect(hours).toHaveAttribute("aria-valuetext", /^16:00: /);

  const link = page.locator("[data-create-link]");
  const href = (await link.getAttribute("href")) ?? "";
  expect(href).toMatch(/[?&]t=\d+/);

  await page.goto(`${href}&mock=clear&at=13:00`);
  await expect(page.getByText(/^Previsione · .*16:00$/)).toBeVisible();
  await expect(page.getByText("Adesso")).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("with no moment chosen on Explore, Create opens on the current conditions", async ({ page }) => {
  await open(page, "clear", "13:00");
  const href = (await page.locator("[data-create-link]").getAttribute("href")) ?? "";
  expect(href).not.toMatch(/[?&]t=/);

  await page.goto(`${href}&mock=clear&at=13:00`);
  await expect(page.getByText(/^Adesso · /)).toBeVisible();
  await expect(page.getByText(/^Previsione/)).toHaveCount(0);
});

test("a moment the forecast no longer holds is said so, and nothing is put in its place", async ({ page }) => {
  await page.goto("/crea?lat=45.07&lon=7.69&name=Torino&mock=clear&at=13:00&t=1000");
  await expect(page.getByRole("status")).toContainText("Il momento scelto non è più disponibile");
  await expect(page.getByRole("link", { name: "Crea per il momento attuale" })).toHaveAttribute("href", /^\/crea\?(?!.*[?&]t=)/);
  await expect(page.getByRole("button", { name: /Crea poster/ })).toHaveCount(0);
  await expect(page.getByText(/^Adesso · /)).toHaveCount(0);
});
