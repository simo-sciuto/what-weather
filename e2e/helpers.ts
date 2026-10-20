import { expect, type Page } from "@playwright/test";

/** Turin, a place with a name and region in the address. */
export const TURIN = { name: "Torino", region: "Piemonte", country: "IT", lat: 45.07, lon: 7.69 };

/**
 * Opens the page on a sample sky at a given hour and waits until it can be
 * used. Not for the whole page to arrive: the last chapters stream in when
 * their sources answer, and no test here waits on the network for them.
 */
export async function open(page: Page, scenario: string, at: string, place?: typeof TURIN) {
  const where = place ? `lat=${place.lat}&lon=${place.lon}&name=${place.name}&` : "";
  await page.goto(`/?${where}mock=${scenario}&at=${at}`, { waitUntil: "commit" });
  await hydrated(page);
}

/** The bar says it is ready once the page is interactive (the records are only read, and the moment only written, from then on). */
export async function hydrated(page: Page) {
  await expect(page.locator('[data-dock][data-ready="true"]')).toBeAttached();
}

/** The bar of the three sections */
export const dock = (page: Page) => page.getByRole("navigation", { name: "Sezioni" });

/** The section's own layer: Crea is shown or hidden, Meteo is the page itself */
export const creaLayer = (page: Page) => page.locator('[data-section="crea"]');

/** Answers the kept records' weather without a server round trip. */
export async function stubSummaries(page: Page) {
  await page.route("**/api/summary?*", (route) =>
    route.fulfill({
      json: {
        temp: 21,
        high: 25,
        low: 15,
        label: "Sereno",
        condition: "clear",
        night: false,
        sky: ["#3b6fb6", "#6f9bd1", "#a9c6e6"],
      },
    }),
  );
}
