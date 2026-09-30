import { expect, type Page } from "@playwright/test";

/** Milan, the place the page opens on. */
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

/** The saved places are only drawn once the page is interactive (before, placeholders stand in). */
export async function hydrated(page: Page) {
  await expect(page.getByRole("list", { name: "Città salvate" })).toBeVisible();
}

/** Answers the saved places' weather without a server round trip. */
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
