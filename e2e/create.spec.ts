import { expect, test } from "@playwright/test";
import { TURIN } from "./helpers";

test("Create takes the place in the address and links back to its weather", async ({ page }) => {
  await page.goto(`/crea?lat=${TURIN.lat}&lon=${TURIN.lon}&name=${TURIN.name}&mock=clear&at=13:00`);

  await expect(page).toHaveTitle(/^Crea · Torino/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Torino");
  await expect(page.getByRole("link", { name: "Torna al meteo di Torino" })).toHaveAttribute("href", /name=Torino/);
});

test("Create with no place in the address is the default place, never a random one", async ({ page }) => {
  await page.goto("/crea?mock=clear&at=13:00");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Milano");
  // The e2e build has no Mapbox token: the poster says why it is not offered
  await expect(page.getByText("Senza una mappa non si può creare il poster.")).toBeVisible();
});

test("the weather page leads to Create for the place on show", async ({ page }) => {
  await page.goto(`/?lat=${TURIN.lat}&lon=${TURIN.lon}&name=${TURIN.name}&mock=clear&at=13:00`);

  await expect(page.getByText("Weather, worth looking at")).toBeVisible();
  const create = page.getByRole("link", { name: /Crea poster/ });
  await expect(create).toHaveAttribute("href", /^\/crea\?lat=45\.0700&lon=7\.6900&name=Torino/);
  await create.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Torino");
});
