import { expect, test } from "@playwright/test";
import { open } from "./helpers";

test("picking a day shows that day, and today brings back now", async ({ page }) => {
  await open(page, "clear", "08:30");
  const days = page.getByRole("region", { name: /^Settimana/ }).getByRole("button");
  const today = days.nth(0);
  const tomorrow = days.nth(1);
  await expect(today).toHaveAttribute("aria-pressed", "true");

  await tomorrow.click();
  await expect(tomorrow).toHaveAttribute("aria-pressed", "true");
  await expect(today).toHaveAttribute("aria-pressed", "false");
  // The reading turns to the day as a whole, and the timeline to its hours
  await expect(page.getByRole("heading", { name: "La giornata" })).toBeAttached();
  await expect(page.getByText("Trascina per esplorare")).toBeHidden();
  // So do the activities, with that day's own best hours
  const activities = page.getByRole("region", { name: /^Attività/ });
  await expect(activities.getByRole("heading", { level: 2 })).toContainText(/Le condizioni di [a-zì]+$/);
  await expect(activities.getByRole("listitem")).toHaveCount(4);
  await expect(activities.getByRole("listitem").first()).toContainText(/Meglio dalle \d+ alle \d+/);

  await today.click();
  await expect(today).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Previsione", exact: true, level: 2 })).toBeAttached();
  await expect(activities.getByRole("heading", { level: 2 })).toContainText("Le condizioni nelle prossime 24 ore");
});

test("a day beyond the hourly forecast says the activities can't be judged", async ({ page }) => {
  await open(page, "clear", "08:30");
  const week = page.getByRole("region", { name: /^Settimana/ });
  // The sample forecast has hours for two days: the third has only a summary
  await week.getByRole("button").nth(2).click();
  const activities = page.getByRole("region", { name: /^Attività/ });
  await expect(activities.getByRole("listitem")).toHaveCount(0);
  await expect(activities).toContainText("Così avanti non ci sono previsioni ora per ora");
});

test("the rest of the week opens on request", async ({ page }) => {
  await open(page, "clear", "08:30");
  const week = page.getByRole("region", { name: /^Settimana/ });
  await expect(week.getByRole("button")).toHaveCount(3);
  // A native <details>: its summary opens it
  await week.getByText(/^Altri \d giorni$/).click();
  await expect(week.getByText("Mostra meno")).toBeVisible();
  await expect(week.getByRole("button")).toHaveCount(8);
});
