/**
 * A board you can use in the browser: `npm run board`, then open the address it prints.
 * It shows docs/BOARD.md as columns and writes every change straight back to that file,
 * and it picks up changes made to the file from elsewhere (an editor, Claude).
 * Local only: it listens on 127.0.0.1 and has no dependencies.
 */
import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { apply, parse, serialize, view } from "./board-md.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = process.env.BOARD_FILE ?? join(HERE, "..", "..", "docs", "BOARD.md");
const PORT = Number(process.env.BOARD_PORT ?? 4321);
const HOST = "127.0.0.1";

const rev = (source) => createHash("sha1").update(source).digest("hex").slice(0, 12);
const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
};

async function snapshot() {
  const source = await readFile(FILE, "utf8");
  return { rev: rev(source), columns: view(parse(source)) };
}

// Changes are applied one at a time, each to the file as it is at that moment.
let queue = Promise.resolve();
const change = (op) => {
  const run = queue.then(async () => {
    const model = parse(await readFile(FILE, "utf8"));
    apply(model, op);
    const next = serialize(model);
    const tmp = `${FILE}.tmp`;
    await writeFile(tmp, next);
    await rename(tmp, FILE);
    return { rev: rev(next), columns: view(model) };
  });
  queue = run.catch(() => {});
  return run;
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 20_000) reject(new Error("Richiesta troppo grande"));
    });
    req.on("end", () => resolve(data));
  });

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    // A page on another site must not be able to write the board: same origin and JSON only.
    const origin = req.headers.origin;
    const local = !origin || origin === `http://localhost:${PORT}` || origin === `http://${HOST}:${PORT}`;

    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(await readFile(join(HERE, "index.html")));
    } else if (req.method === "GET" && url.pathname === "/api/board") {
      const board = await snapshot();
      json(res, 200, url.searchParams.get("rev") === board.rev ? { rev: board.rev, unchanged: true } : board);
    } else if (req.method === "POST" && url.pathname === "/api/op") {
      if (!local || !req.headers["content-type"]?.startsWith("application/json")) return json(res, 403, { error: "Non consentito" });
      json(res, 200, await change(JSON.parse(await readBody(req))));
    } else {
      json(res, 404, { error: "Non trovato" });
    }
  } catch (error) {
    json(res, 400, { error: error instanceof Error ? error.message : "Errore" });
  }
}).listen(PORT, HOST, () => console.log(`Board: http://localhost:${PORT}  (file: docs/BOARD.md)`));
