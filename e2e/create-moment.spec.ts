import { expect, test } from "@playwright/test";
import { creaLayer, dock, open, stubSummaries } from "./helpers";

// The moment chosen on Meteo reaches Crea by its instant (WTH-236). The sample sky is given to `/crea` by the test
// (`mock`, `at`): the link does not carry it, and in production the live forecast needs no such parameters.

test.beforeEach(async ({ page }) => {
  await stubSummaries(page);
});

test("a forecast hour chosen on Meteo opens /crea on that hour, marked as a forecast", async ({ page }) => {
  await open(page, "clear", "13:00");
  const hours = page.getByRole("slider", { name: "Ora da mostrare" });
  await hours.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await expect(hours).toHaveAttribute("aria-valuetext", /^16:00: /);
  await expect.poll(() => page.url()).toMatch(/[?&]t=\d{10}/);
  const t = new URL(page.url()).searchParams.get("t");

  await page.goto(`/crea?lat=45.07&lon=7.69&name=Torino&t=${t}&mock=clear&at=13:00`);
  await expect(creaLayer(page).getByText(/^Previsione · .*16:00$/)).toBeVisible();
  await expect(creaLayer(page).getByText("Adesso")).toHaveCount(0);
  await expect(creaLayer(page).getByRole("status")).toHaveCount(0);
  // and Meteo, in the same page, is at the same hour
  await dock(page).getByRole("link", { name: "Meteo" }).click();
  await expect(page.getByRole("slider", { name: "Ora da mostrare" })).toHaveAttribute("aria-valuetext", /^16:00: /);
});

test("with no moment chosen, /crea opens on the current conditions", async ({ page }) => {
  await page.goto("/crea?lat=45.07&lon=7.69&name=Torino&mock=clear&at=13:00");
  await expect(creaLayer(page).getByText(/^Adesso · /)).toBeVisible();
  await expect(creaLayer(page).getByText(/^Previsione/)).toHaveCount(0);
});

test("a moment the forecast no longer holds is said so, and nothing is put in its place", async ({ page }) => {
  await page.goto("/crea?lat=45.07&lon=7.69&name=Torino&mock=clear&at=13:00&t=1000");
  const status = creaLayer(page).getByRole("status");
  await expect(status).toContainText("Il momento scelto non è più disponibile");
  // in the words of the sections: the other hour is chosen in Meteo
  await expect(status).toContainText("Scegline un altro in Meteo");
  await expect(status).not.toContainText("Explore");
  await expect(creaLayer(page).getByRole("link", { name: "Crea per il momento attuale" })).toHaveAttribute("href", /^\/crea\?(?!.*[?&]t=)/);
  await expect(page.getByRole("button", { name: /Crea poster/ })).toHaveCount(0);
  await expect(creaLayer(page).getByText(/^Adesso · /)).toHaveCount(0);
});
