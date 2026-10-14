#!/usr/bin/env node
/**
 * The Atlas camera port against the real Mapbox GL JS (ADR-020, M2): does the event data tell the person's moves from
 * the code's, whatever the gesture, and does the settle controller behave on a real map? No Mapbox service, no token:
 * the map has an empty style, the page is served from this machine, and any other address is refused (and counted).
 *
 *   node scripts/atlas/camera-harness.mjs
 *
 * Needs `npm ci` (mapbox-gl, @playwright/test and esbuild, which comes with vitest) and a Chromium: the one Playwright
 * has installed, or PLAYWRIGHT_CHROMIUM=/path/to/chrome. Exits 1 when an assertion fails.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const QUIET = 300;

const bundle = await build({
  entryPoints: ["scripts/atlas/harness.ts"],
  bundle: true,
  write: false,
  format: "iife",
  target: "es2022",
  logLevel: "warning",
});
const files = {
  "/harness.js": [bundle.outputFiles[0].text, "text/javascript"],
  "/mapbox-gl.js": [readFileSync("node_modules/mapbox-gl/dist/mapbox-gl.js"), "text/javascript"],
  "/mapbox-gl.css": [readFileSync("node_modules/mapbox-gl/dist/mapbox-gl.css"), "text/css"],
  "/": [`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/mapbox-gl.css"><body style="margin:0"><div id="map" style="width:800px;height:600px"></div><script src="/mapbox-gl.js"></script><script src="/harness.js"></script>`, "text/html"],
};
const server = createServer((req, res) => {
  const hit = files[req.url.split("?")[0]];
  if (!hit) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": hit[1] });
  res.end(hit[0]);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const executablePath = process.env.PLAYWRIGHT_CHROMIUM;
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox", "--disable-background-networking"],
});
let refused = 0;
const leaked = [];
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  // A request that left this machine and came back answered would be a leak: none may finish
  page.on("requestfinished", (r) => {
    if (!r.url().startsWith(origin) && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) leaked.push(r.url());
  });
  // Nothing leaves this machine: Mapbox's telemetry and session requests are refused, and counted
  await page.route("**/*", (route) => {
    if (route.request().url().startsWith(origin) || route.request().url().startsWith("data:") || route.request().url().startsWith("blob:")) return route.continue();
    refused++;
    return route.abort();
  });
  await page.goto(origin + "/");
  await page.waitForFunction(() => window.startAtlas);
  await page.evaluate(async (q) => {
    window.atlas = window.startAtlas(q);
    await window.atlas.loaded;
  }, QUIET);
  const snap = () => page.evaluate(() => window.atlas.snapshot());
  const reset = async () => {
    await page.evaluate(() => {
      window.atlas.resetCamera();
      window.atlas.reset();
    });
    await page.waitForTimeout(QUIET + 250);
    await page.evaluate(() => window.atlas.reset());
  };

  // 1. The code's own moves, by every command, are marked as the code's at both ends, and settle nothing
  for (const name of ["jumpTo", "easeTo", "flyTo", "setPadding"]) {
    await reset();
    await page.evaluate((n) => window.atlas.command(n), name);
    await page.waitForTimeout(QUIET + 700);
    const s = await snap();
    const ev = s.events.filter((e) => e.type !== "move");
    check(
      `${name}: movestart and moveend both say "program", the map's own events carry no original event`,
      ev.length >= 2 && ev.every((e) => e.origin === "program") && s.raw.every((r) => !r.hasOriginalEvent),
      `${ev.map((e) => e.type + ":" + e.origin).join(",")}`,
    );
    check(`${name}: asks for nothing, the phase stays resting`, s.commits.length === 0 && s.phase === "resting");
  }

  // 2. 30 commands one frame apart (the home's backdrop pattern, but through the port)
  await reset();
  await page.evaluate(() => window.atlas.jumpEveryFrame());
  await page.waitForTimeout(QUIET + 300);
  {
    const s = await snap();
    check("30 tagged jumps, a frame apart: every event is the code's, nothing is asked for, the status never changes", s.events.every((e) => e.origin === "program") && s.commits.length === 0 && s.statusChanges === 0, `${s.events.length} events`);
  }

  // 3. A slow drag: the person's, nothing asked for while the button is down, one request after the quiet
  await reset();
  await page.mouse.move(400, 300);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(400 + i * 10, 300 + i * 3);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(QUIET + 400); // held still with the button down, longer than the quiet
  {
    const s = await snap();
    check("slow drag, held still beyond the quiet with the button down: nothing is asked for", s.commits.length === 0 && s.phase === "moving", `phase ${s.phase}`);
  }
  await page.mouse.up();
  const upAt = (await snap()).t;
  await page.waitForTimeout(QUIET + 500);
  {
    const s = await snap();
    const end = s.events.findLast((e) => e.type === "moveend");
    check("slow drag: its events say \"user\"", s.events.every((e) => e.origin === "user") && s.events.some((e) => e.type === "movestart"));
    check("slow drag: a listener that did not ask for frames heard no \"move\" at all", s.events.every((e) => e.type !== "move"));
    check("slow drag: exactly one request, after the quiet counted from moveend", s.commits.length === 1 && s.commits[0].t >= end.t + QUIET - 30, `moveend ${end?.t}, request ${s.commits[0]?.t}, release ${upAt}`);
    check("slow drag: the request is for the cell the map rests on", s.commits[0] && Math.abs(s.commits[0].cell.lon - Math.round((await page.evaluate(() => window.atlas.center().lng)) * 100) / 100) < 0.02);
    check("slow drag: after the answer the phase is resting", s.phase === "resting");
  }

  // 4. A fast flick: the map keeps moving after release (inertia); the quiet starts when it stops
  await reset();
  await page.mouse.move(400, 300);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(400 + i * 40, 300 + i * 10);
    await page.waitForTimeout(4);
  }
  await page.mouse.up();
  const flickUp = (await snap()).t;
  await page.waitForTimeout(QUIET + 2500);
  {
    const s = await snap();
    const end = s.events.findLast((e) => e.type === "moveend");
    check("fast flick: moveend comes after the release, with inertia", end && end.t - flickUp > 100, `release ${flickUp}, moveend ${end?.t}`);
    check("fast flick: one request, after the quiet counted from the end of the inertia", s.commits.length === 1 && s.commits[0].t >= end.t + QUIET - 30, `request ${s.commits[0]?.t}`);
  }

  // 5. A wheel zoom: the map's own events carry no original event, and the port still says "user"
  await reset();
  await page.mouse.move(400, 300);
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(QUIET + 900);
  {
    const s = await snap();
    check("wheel zoom: the map's events carry no original event (so it cannot tell)", s.raw.length > 0 && s.raw.every((r) => !r.hasOriginalEvent), `${s.raw.length} events`);
    check("wheel zoom: the port says \"user\" all the same", s.events.filter((e) => e.type !== "move").every((e) => e.origin === "user") && s.events.length > 0);
    check("wheel zoom: one request after the quiet", s.commits.length === 1, `${s.commits.length}`);
  }

  // 6. The keyboard
  await reset();
  await page.evaluate(() => window.atlas.focus());
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(QUIET + 700);
  {
    const s = await snap();
    check("keyboard: its events say \"user\" and the settle asks once", s.events.filter((e) => e.type !== "move").every((e) => e.origin === "user") && s.events.length > 0 && s.commits.length === 1);
  }

  // 7. A move straight on the map, not through the port, is untagged and counts as the person's
  await reset();
  await page.evaluate(() => window.atlas.untaggedJump());
  await page.waitForTimeout(QUIET + 300);
  {
    const s = await snap();
    check("a jumpTo made straight on the map counts as the person's (the rule: only the port's commands are the code's)", s.events.filter((e) => e.type !== "move").every((e) => e.origin === "user") && s.commits.length === 1);
  }

  // 8. A command of the code during a quiet cancels it
  await reset();
  await page.mouse.move(400, 300);
  await page.mouse.down();
  for (let i = 1; i <= 4; i++) await page.mouse.move(400 + i * 12, 300);
  await page.mouse.up();
  // The map still glides for a moment after the release: wait for its end, when the quiet begins
  const quietBegan = await page.waitForFunction(() => window.atlas.phase() === "settling", null, { timeout: 3000, polling: "raf" }).then(() => true, () => false);
  check("(setup) the quiet is running when the command comes", quietBegan);
  await page.evaluate(() => window.atlas.jumpTo());
  await page.waitForTimeout(QUIET + 500);
  {
    const s = await snap();
    check("a command of the code during the quiet cancels it: nothing is asked for", s.commits.length === 0 && s.phase === "resting", `phase ${s.phase}`);
  }

  // 8b. The person interrupts a flight of the code: its end is still the code's, what follows is the person's
  await reset();
  await page.evaluate(() => window.atlas.flyLong());
  await page.waitForTimeout(400);
  await page.mouse.move(400, 300);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) {
    await page.mouse.move(400 + i * 12, 300 + i * 4);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  await page.waitForTimeout(QUIET + 900);
  {
    const s = await snap();
    const seq = s.events.filter((e) => e.type !== "move").map((e) => `${e.type}:${e.origin}`);
    const cut = s.events.findIndex((e) => e.type === "moveend" && e.origin === "program");
    const next = s.events.findIndex((e, i) => i > cut && e.type === "movestart" && e.origin === "user");
    check("a flight the person interrupts: the flight ends as the code's, then the person's movement starts", cut >= 0 && next > cut, seq.join(" "));
    const last = s.events.findLast((e) => e.type === "moveend");
    check("and the settle asks once, after the person's quiet", s.commits.length === 1 && last.origin === "user" && s.commits[0].t >= last.t + QUIET - 30, `${s.commits.length} request(s)`);
  }

  // 9. The frames of a movement reach only a listener that asks for them; nothing is heard after dispose
  {
    await page.evaluate(() => window.atlas.framesListener(true));
    await reset();
    const from = await page.evaluate(() => window.atlas.framesHeard());
    await page.evaluate(() => window.atlas.jumpEveryFrame());
    const to = await page.evaluate(() => window.atlas.framesHeard());
    const heardByPort = to.port - from.port;
    const firedByMap = to.map - from.map;
    check("a listener that asks for frames hears every \"move\" the map fires, none twice and none missed", heardByPort > 0 && heardByPort === firedByMap, `port ${heardByPort}, map ${firedByMap}`);
    await page.evaluate(() => window.atlas.framesListener(false));
    await page.evaluate(() => window.atlas.jumpEveryFrame());
    const end = await page.evaluate(() => window.atlas.framesHeard());
    check("and it hears none once it has left, while the map goes on firing them", end.port === to.port && end.map > to.map, `port ${end.port}, map ${end.map}`);
    await page.evaluate(() => {
      window.atlas.controllerDispose();
      window.atlas.dispose();
      window.atlas.reset();
      window.atlas.untaggedJump();
    });
    await page.waitForTimeout(QUIET + 300);
    const gone = await snap();
    check("after dispose a move of the map reaches neither the port's listeners nor the controller", gone.events.length === 0 && gone.statusChanges === 0 && gone.commits.length === 0);
  }

  check(`no request left this machine: none finished, and ${refused} (the map's telemetry and session calls) were refused`, leaked.length === 0, leaked.slice(0, 3).join(" "));
} finally {
  await browser.close();
  server.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
