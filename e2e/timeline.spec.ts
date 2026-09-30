import { expect, test } from "@playwright/test";
import { open } from "./helpers";

test.beforeEach(async ({ page }) => {
  await open(page, "clear", "13:00");
});

test("the keyboard moves through the hours, and back to now", async ({ page }) => {
  const hours = page.getByRole("slider", { name: "Ora da mostrare" });
  await expect(page.getByText("Trascina per esplorare")).toBeVisible();

  await hours.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");

  // Three hours on: the reading is that hour's, and says so
  await expect(hours).toHaveAttribute("aria-valuetext", /^16:00: /);
  await expect(page.getByRole("heading", { name: "Alle 16:00" })).toBeAttached();
  await expect(page.getByText("Trascina per esplorare")).toBeHidden();

  await page.getByRole("button", { name: "Torna ad adesso" }).click();
  await expect(page.getByRole("heading", { name: "Previsione", exact: true, level: 2 })).toBeAttached();
  await expect(page.getByText("Trascina per esplorare")).toBeVisible();
});

test("a click on the timeline shows the hour under it", async ({ page }) => {
  const plot = page.locator("[data-timeline-plot]");
  const box = (await plot.boundingBox())!;
  // Half way through the next 24 hours
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(page.getByRole("slider", { name: "Ora da mostrare" })).toHaveAttribute("aria-valuetext", /^01:00: /);
  await expect(page.getByRole("button", { name: "Torna ad adesso" })).toBeVisible();
});

test("the curve can draw the wind instead of the temperature", async ({ page }) => {
  const metrics = page.getByRole("group", { name: "Grandezza sulla curva" });
  await expect(metrics.getByRole("button")).toHaveText(["Temperatura", "Pioggia", "Vento", "UV"]);
  await expect(metrics.getByRole("button", { name: "Temperatura" })).toHaveAttribute("aria-pressed", "true");

  await metrics.getByRole("button", { name: "Vento" }).click();
  await expect(metrics.getByRole("button", { name: "Vento" })).toHaveAttribute("aria-pressed", "true");
  await expect(metrics.getByRole("button", { name: "Temperatura" })).toHaveAttribute("aria-pressed", "false");
  // The unit of what is drawn, and its values on the curve: the sample wind blows at 8 km/h
  await expect(metrics).toContainText("km/h");
  await expect(page.locator("[data-timeline-plot]")).toContainText("8");
  await expect(page.locator("[data-timeline-plot]")).not.toContainText("°");
});

test("marks the best hours to be outside, in a drawing and in words", async ({ page }) => {
  await expect(page.getByText(/^Momento migliore: /)).toContainText(/(dalle|da|adesso|verso|domani) /);
});
