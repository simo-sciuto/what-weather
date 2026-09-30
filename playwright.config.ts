import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests: the built site, served on its own port with the sample
 * weather (WEATHER_PROVIDER=mock), so every run sees the same skies whatever
 * the real ones do. `?mock=<scenario>&at=HH:MM` picks the weather and the hour.
 * It is built without the Mapbox token, so there are no maps and no
 * "Territorio" chapter: nothing the tests touch waits on a service outside
 * (the build replaces the one in .next: run `npm run build` again for a full one).
 * They drive the Chrome installed on the machine, so there is no browser to
 * download. A server already up on the port is reused (not on CI).
 */
const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  // Roomy, for a busy machine: the first paint of a page waits on the server rendering it.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "it-IT",
    timezoneId: "Europe/Rome",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", testIgnore: /phone\.spec\.ts/, use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "phone", testMatch: /phone\.spec\.ts/, use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    // An empty value still wins over .env.local, which only fills what isn't set.
    env: { WEATHER_PROVIDER: "mock", NEXT_PUBLIC_MAPBOX_TOKEN: "" },
  },
});
