#!/usr/bin/env node
/**
 * Exports the Visual Record spike (WTH-187): every test record as a full-size PNG (2480 x 3508), a contact sheet
 * and a sheet of 120 px thumbnails, through the browser's own type and the app's SVG-to-PNG export.
 *
 *   node scripts/record/export-sheet.mjs <output folder>
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { chromium } from "@playwright/test";

const outDir = process.argv[2] ?? "record-export";
mkdirSync(outDir, { recursive: true });

const bundle = await build({
  entryPoints: ["scripts/record/harness.ts"],
  bundle: true,
  write: false,
  format: "iife",
  target: "es2022",
  loader: { ".json": "json" },
  logLevel: "warning",
});
const js = bundle.outputFiles[0].text;
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff"><script>${js}</script>`;

const server = createServer((req, res) => {
  if (req.url === "/" || req.url === "/index.html") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(html);
  }
  try {
    const body = readFileSync(join("public", decodeURIComponent(req.url.split("?")[0])));
    res.writeHead(200, { "content-type": extname(req.url) === ".woff2" ? "font/woff2" : "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const port = server.address().port;

// A preinstalled Chromium when the environment has one (PLAYWRIGHT_CHROMIUM), else Playwright's own
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
try {
  const page = await browser.newPage();
  page.on("console", (m) => m.type() === "error" && console.error("page:", m.text()));
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`http://127.0.0.1:${port}/`);
  const result = await page.evaluate((which) => window.runRecords(which), process.argv[3] === "spike" ? "spike" : "all");
  const save = (name, dataUrl) => writeFileSync(join(outDir, name), Buffer.from(dataUrl.split(",")[1], "base64"));
  for (const r of result.out) {
    save(`${r.key}.png`, r.png);
    console.log(r.key, JSON.stringify(r.meta));
  }
  save("contact-sheet.png", result.contact);
  save("thumbnails-120.png", result.thumbs);
  if (result.edges) save("edge-cases.png", result.edges);
  save("foot-at-100.png", result.foot);
} finally {
  await browser.close();
  server.close();
}
