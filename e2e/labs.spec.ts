import { expect, test } from "@playwright/test";

// The e2e build is a production build: the development labs are not served from it (WTH-248)
test("the atmosphere lab is not served by a production build", async ({ request }) => {
  const res = await request.get("/lab/atmosfera");
  expect(res.status()).toBe(404);
});
