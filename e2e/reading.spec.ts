import { expect, test } from "@playwright/test";
import { open } from "./helpers";

test("shows the place, its reading and the chapters", async ({ page }) => {
  await open(page, "clear", "13:00");

  await expect(page).toHaveTitle(/^Milano \d+° · Sereno$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Milano");
  const reading = page.getByRole("region", { name: "Meteo attuale" });
  await expect(reading).toContainText(/Adesso \d+°, sereno, percepita \d+°/);
  // The outlook: a sentence, not a list of numbers
  await expect(page.getByRole("region", { name: "Previsione" })).toContainText(/^[A-ZÀ-Ý].+\.$/);

  for (const chapter of ["Attività", "Settimana", "Dettagli"]) {
    await expect(page.getByRole("heading", { level: 2, name: chapter })).toBeVisible();
  }
});

test("says what the sample data is, and links the other skies", async ({ page }) => {
  await open(page, "fog", "08:30");
  const scenarios = page.getByRole("navigation", { name: "Scenari meteo di esempio" });
  await expect(scenarios.getByRole("link", { name: "fog" })).toHaveAttribute("aria-current", "page");
  await expect(scenarios.getByRole("link")).toHaveCount(10);
});
