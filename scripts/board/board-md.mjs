/**
 * Reads and rewrites docs/BOARD.md without disturbing anything it does not
 * understand. The file is kept as lines; only task lines ("- [ ] WTH-001 text")
 * are parsed into items, every other line stays exactly as it was.
 */

export const COLUMNS = ["NOW", "NEXT", "LATER", "DONE"];
/** Where items moved to DONE land, a group created on demand at the top of DONE */
const RECENT = "Recenti";
const EMPTY = {
  NOW: "- (nothing active: ask the user what to start)",
  NEXT: "- (nothing queued)",
  LATER: "- (nothing here)",
};

const ITEM = /^- \[( |x)\] (WTH-\d+) (.*)$/;
const idNumber = (id) => Number(id.slice(4));

export function parse(source) {
  const lines = source.split("\n");
  const trailing = lines[lines.length - 1] === "" ? lines.pop() !== undefined : false;
  const sections = [];
  const pre = [];
  let current = null;
  for (const line of lines) {
    const heading = line.match(/^## (\w+)\s*$/);
    if (heading && COLUMNS.includes(heading[1])) {
      current = { name: heading[1], heading: line, body: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      pre.push(line);
      continue;
    }
    const m = line.match(ITEM);
    current.body.push(m ? { id: m[2], done: m[1] === "x", text: m[3] } : line);
  }
  return { pre, sections, trailing };
}

export function serialize(model) {
  const out = [...model.pre];
  for (const s of model.sections) {
    out.push(s.heading);
    for (const l of s.body) out.push(typeof l === "string" ? l : `- [${l.done ? "x" : " "}] ${l.id} ${l.text}`);
  }
  return out.join("\n") + (model.trailing ? "\n" : "");
}

const isItem = (l) => typeof l !== "string";
const section = (model, name) => model.sections.find((s) => s.name === name);

/** What the page shows: per column, its items, grouped by "###" headings where there are any */
export function view(model) {
  return model.sections.map((s) => {
    const groups = [{ title: null, items: [] }];
    for (const l of s.body) {
      if (typeof l === "string" && l.startsWith("### ")) groups.push({ title: l.slice(4).trim(), items: [] });
      else if (isItem(l)) groups[groups.length - 1].items.push({ id: l.id, text: l.text, done: l.done });
    }
    return { name: s.name, groups: groups.filter((g) => g.items.length || g.title) };
  });
}

function find(model, id) {
  for (const s of model.sections) {
    const index = s.body.findIndex((l) => isItem(l) && l.id === id);
    if (index !== -1) return { section: s, index };
  }
  return null;
}

const nextId = (model) => {
  const ids = model.sections.flatMap((s) => s.body.filter(isItem).map((l) => idNumber(l.id)));
  return `WTH-${String(Math.max(0, ...ids) + 1).padStart(3, "0")}`;
};

const cleanText = (text) => String(text ?? "").replace(/\s+/g, " ").trim();

function place(model, item, column, beforeId) {
  const s = section(model, column);
  if (!s) throw new Error(`Unknown column ${column}`);
  item.done = column === "DONE";
  // The placeholder line goes as soon as there is something to show.
  s.body = s.body.filter((l) => isItem(l) || !l.startsWith("- ("));

  if (column === "DONE") {
    let heading = s.body.findIndex((l) => l === `### ${RECENT}`);
    if (heading === -1) {
      const firstGroup = s.body.findIndex((l) => typeof l === "string" && l.startsWith("### "));
      const at = firstGroup === -1 ? s.body.length : firstGroup;
      s.body.splice(at, 0, `### ${RECENT}`, "", item, "");
      return;
    }
    let at = heading + 1;
    while (at < s.body.length && !(typeof s.body[at] === "string" && s.body[at].startsWith("### "))) at++;
    // Just after the group's last item, before the blank line that closes it.
    let last = at - 1;
    while (last > heading && !isItem(s.body[last])) last--;
    s.body.splice(last + 1, 0, item);
    return;
  }

  const before = beforeId ? s.body.findIndex((l) => isItem(l) && l.id === beforeId) : -1;
  if (before !== -1) {
    s.body.splice(before, 0, item);
    return;
  }
  let last = s.body.length - 1;
  while (last >= 0 && !isItem(s.body[last])) last--;
  if (last >= 0) s.body.splice(last + 1, 0, item);
  else {
    // An empty column: after the blank line under its heading.
    const at = s.body[0] === "" ? 1 : 0;
    s.body.splice(at, 0, item);
    if (s.body[at + 1] !== "") s.body.splice(at + 1, 0, "");
  }
}

/** A "Recenti" group with nothing in it is not left behind; an empty column gets its placeholder back. */
function tidy(model) {
  for (const s of model.sections) {
    const heading = s.body.findIndex((l) => l === `### ${RECENT}`);
    if (heading !== -1) {
      let end = heading + 1;
      while (end < s.body.length && !(typeof s.body[end] === "string" && s.body[end].startsWith("### "))) end++;
      if (!s.body.slice(heading, end).some(isItem)) s.body.splice(heading, end - heading);
    }
    if (EMPTY[s.name] && !s.body.some(isItem) && !s.body.some((l) => typeof l === "string" && l.startsWith("- ("))) {
      s.body = ["", EMPTY[s.name], ""];
    }
  }
}

/** Applies one change from the page to a freshly read file. Throws a message the page can show. */
export function apply(model, op) {
  if (op.op === "add") {
    if (op.column === "DONE") throw new Error("Una nuova voce non nasce già fatta");
    const text = cleanText(op.text);
    if (!text) throw new Error("Scrivi cosa c'è da fare");
    place(model, { id: nextId(model), done: false, text }, op.column, null);
  } else {
    const at = find(model, op.id);
    if (!at) throw new Error(`${op.id} non c'è più: la board è cambiata`);
    const item = at.section.body[at.index];
    if (op.op === "edit") {
      const text = cleanText(op.text);
      if (!text) throw new Error("Il testo non può essere vuoto");
      item.text = text;
    } else if (op.op === "delete") {
      at.section.body.splice(at.index, 1);
    } else if (op.op === "move") {
      if (op.column === at.section.name && op.column === "DONE") return tidy(model);
      at.section.body.splice(at.index, 1);
      place(model, item, op.column, op.beforeId === op.id ? null : op.beforeId);
    } else {
      throw new Error(`Operazione sconosciuta: ${op.op}`);
    }
  }
  tidy(model);
}
