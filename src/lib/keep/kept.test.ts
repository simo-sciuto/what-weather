import { describe, expect, it } from "vitest";
import {
  MAX_KEPT,
  liveRecordAt,
  newestFirst,
  newRecordId,
  parseKept,
  recordFromSaved,
  recordsFromSaved,
  savedPlaceId,
  withRecord,
  withoutRecord,
  type KeptRecord,
} from "./kept-record";
import { KEPT_KEY, SAVED_KEY, addKept, keptSnapshot, migrateSavedPlaces, readKept, removeKept, writeKept, type KeptStorage } from "./kept-store";

function memory(initial: Record<string, string> = {}, limit = Infinity): KeptStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      if (v.length > limit) throw new DOMException("full", "QuotaExceededError");
      data[k] = v;
    },
  };
}

const torino = { lat: 45.07, lon: 7.69, name: "Torino", region: "Piemonte", country: "IT" };
const roma = { lat: 41.89, lon: 12.49, name: "Roma" };

const record = (over: Partial<KeptRecord> = {}): KeptRecord => ({
  id: "r1",
  place: torino,
  t: 1792418400,
  format: "a4",
  createdAt: 1000,
  ...over,
});

describe("saved places become records of Adesso (ADR-028)", () => {
  it("a saved place is a record with no moment, the default format and no thumbnail", () => {
    expect(recordFromSaved(torino, 500)).toEqual({ id: "p45.07_7.69", place: torino, t: null, format: "a4", createdAt: 500 });
  });

  it("the names that are not there stay out, they are not written as undefined", () => {
    const r = recordFromSaved(roma, 1);
    expect("region" in r.place).toBe(false);
    expect("country" in r.place).toBe(false);
  });

  it("the list order survives as the order of createdAt, one second apart", () => {
    const list = recordsFromSaved([torino, roma], 100);
    expect(list.map((r) => [r.place.name, r.createdAt])).toEqual([["Torino", 100], ["Roma", 101]]);
  });

  it("two places the same to the hundredth of a degree make one record", () => {
    const list = recordsFromSaved([torino, { ...torino, lat: 45.071 }, roma], 1);
    expect(list.map((r) => r.place.name)).toEqual(["Torino", "Roma"]);
    expect(new Set(list.map((r) => r.id)).size).toBe(list.length);
  });

  it("migrating twice makes the same ids", () => {
    expect(recordsFromSaved([torino], 1)[0].id).toBe(recordsFromSaved([torino], 99)[0].id);
    expect(savedPlaceId(torino)).toBe("p45.07_7.69");
  });
});

describe("parseKept: a record read from storage", () => {
  it("accepts a good one and keeps its thumbnail", () => {
    const r = record({ thumb: "data:image/webp;base64,AAAA" });
    expect(parseKept(JSON.parse(JSON.stringify(r)))).toEqual(r);
  });

  it("accepts a record of Adesso (t null)", () => {
    expect(parseKept(record({ t: null }))?.t).toBeNull();
  });

  it("drops what is not a record, field by field", () => {
    const bad: unknown[] = [
      null,
      "x",
      [],
      record({ id: "" }),
      { ...record(), place: { lat: 91, lon: 0, name: "x" } },
      { ...record(), place: { ...torino, name: "  " } },
      { ...record(), place: { ...torino, lat: "45" } },
      record({ t: 12.5 }),
      record({ t: 5 }),
      record({ t: 1e21 }),
      { ...record(), t: "1792418400" },
      { ...record(), format: "poster" },
      { ...record(), createdAt: "now" },
    ];
    for (const b of bad) expect(parseKept(b)).toBeNull();
  });

  it("leaves out a thumbnail that is not an image or is too big, and keeps the record", () => {
    expect(parseKept(record({ thumb: "https://x.test/a.png" }))?.thumb).toBeUndefined();
    expect(parseKept(record({ thumb: "data:image/png;base64," + "A".repeat(30_000) }))?.thumb).toBeUndefined();
    expect(parseKept(record({ thumb: "https://x.test/a.png" }))).not.toBeNull();
  });
});

describe("the list: add, remove, order", () => {
  it("adds as the newest and replaces one of the same id", () => {
    const list = withRecord([record({ id: "a", createdAt: 1 }), record({ id: "b", createdAt: 2 })], record({ id: "a", createdAt: 3 }));
    expect(list.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("drops the oldest past the maximum", () => {
    let list: KeptRecord[] = [];
    for (let i = 0; i < MAX_KEPT + 3; i++) list = withRecord(list, record({ id: `r${i}`, createdAt: i }));
    expect(list).toHaveLength(MAX_KEPT);
    expect(list[0].id).toBe("r3");
  });

  it("removes by id and shows the newest first", () => {
    const list = [record({ id: "a", createdAt: 1 }), record({ id: "b", createdAt: 2 })];
    expect(withoutRecord(list, "a").map((r) => r.id)).toEqual(["b"]);
    expect(newestFirst(list).map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("finds the record of Adesso at a place, by about a kilometre", () => {
    const list = [record({ t: 5000 }), record({ id: "live", t: null })];
    expect(liveRecordAt(list, { lat: 45.071, lon: 7.691 })?.id).toBe("live");
    expect(liveRecordAt(list, roma)).toBeUndefined();
  });

  it("new ids differ for two made in the same second", () => {
    expect(newRecordId(1792418400, "a")).not.toBe(newRecordId(1792418400, "b"));
  });
});

describe("the store: guarded, versioned, never losing the old key", () => {
  it("reads nothing when nothing is stored, and ignores a broken value", () => {
    expect(readKept(memory())).toEqual([]);
    expect(readKept(memory({ [KEPT_KEY]: "{not json" }))).toEqual([]);
    expect(readKept(memory({ [KEPT_KEY]: JSON.stringify({ v: 1, records: "no" }) }))).toEqual([]);
  });

  it("adds, reads back and removes", () => {
    const s = memory();
    expect(addKept(s, record({ id: "a", createdAt: 1 }))).toBe(true);
    expect(addKept(s, record({ id: "b", createdAt: 2 }))).toBe(true);
    expect(readKept(s).map((r) => r.id)).toEqual(["a", "b"]);
    expect(removeKept(s, "a")).toBe(true);
    expect(readKept(s).map((r) => r.id)).toEqual(["b"]);
  });

  it("skips the entries that are not records and keeps the rest", () => {
    const s = memory({ [KEPT_KEY]: JSON.stringify({ v: 1, records: [record({ id: "ok" }), { id: "bad" }] }) });
    expect(readKept(s).map((r) => r.id)).toEqual(["ok"]);
  });

  it("does not read, and never writes over, a version newer than it knows", () => {
    const stored = JSON.stringify({ v: 9, records: [record()] });
    const s = memory({ [KEPT_KEY]: stored });
    expect(readKept(s)).toEqual([]);
    expect(addKept(s, record({ id: "new" }))).toBe(false);
    expect(removeKept(s, "r1")).toBe(false);
    expect(writeKept(s, [])).toBe(false);
    expect(s.data[KEPT_KEY]).toBe(stored);
  });

  it("a stored value that cannot be read at all is replaced by a write, there is nothing in it to keep", () => {
    const s = memory({ [KEPT_KEY]: "{not json" });
    expect(addKept(s, record({ id: "a", createdAt: 1 }))).toBe(true);
    expect(readKept(s).map((r) => r.id)).toEqual(["a"]);
  });

  it("storage that cannot be read refuses a write, so nothing existing is overwritten", () => {
    const blocked: KeptStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("should not be called"); } };
    expect(writeKept(blocked, [record()])).toBe(false);
  });

  it("when the images do not fit it keeps the records without them", () => {
    const thumb = "data:image/png;base64," + "A".repeat(20_000);
    const s = memory({}, 2_000);
    expect(writeKept(s, [record({ thumb })])).toBe(true);
    expect(readKept(s)[0].thumb).toBeUndefined();
  });

  it("says so when nothing fits, and writes nothing", () => {
    const s = memory({}, 10);
    expect(writeKept(s, [record()])).toBe(false);
    expect(KEPT_KEY in s.data).toBe(false);
  });

  it("a storage that throws on read is empty, not a crash", () => {
    const throwing: KeptStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readKept(throwing)).toEqual([]);
    expect(keptSnapshot(throwing)).toBe("");
    expect(migrateSavedPlaces(throwing, 1)).toEqual([]);
  });
});

describe("migrateSavedPlaces: once, and without deleting the old key", () => {
  const saved = JSON.stringify([torino, roma]);

  it("brings the saved places in as records of Adesso and leaves the old key as it was", () => {
    const s = memory({ [SAVED_KEY]: saved });
    const records = migrateSavedPlaces(s, 1000);
    expect(records.map((r) => [r.place.name, r.t])).toEqual([["Torino", null], ["Roma", null]]);
    expect(readKept(s)).toHaveLength(2);
    expect(s.data[SAVED_KEY]).toBe(saved);
  });

  it("does nothing the second time, so a record removed stays removed", () => {
    const s = memory({ [SAVED_KEY]: saved });
    migrateSavedPlaces(s, 1000);
    removeKept(s, savedPlaceId(torino));
    migrateSavedPlaces(s, 2000);
    expect(readKept(s).map((r) => r.place.name)).toEqual(["Roma"]);
  });

  it("does not bring them back when the person removed every record", () => {
    const s = memory({ [SAVED_KEY]: saved });
    migrateSavedPlaces(s, 1000);
    removeKept(s, savedPlaceId(torino));
    removeKept(s, savedPlaceId(roma));
    expect(migrateSavedPlaces(s, 3000)).toEqual([]);
  });

  it("with no saved places there is nothing to write", () => {
    const s = memory();
    expect(migrateSavedPlaces(s, 1)).toEqual([]);
    expect(KEPT_KEY in s.data).toBe(false);
  });

  it("does not migrate over records it cannot read or that a newer version wrote", () => {
    const newer = JSON.stringify({ v: 9, records: [record()] });
    const a = memory({ [SAVED_KEY]: saved, [KEPT_KEY]: newer });
    expect(migrateSavedPlaces(a, 1)).toEqual([]);
    expect(a.data[KEPT_KEY]).toBe(newer);
    const b = memory({ [SAVED_KEY]: saved, [KEPT_KEY]: "{broken" });
    expect(migrateSavedPlaces(b, 1)).toEqual([]);
    expect(b.data[KEPT_KEY]).toBe("{broken");
  });

  it("does not migrate when the new key cannot be read, and so cannot overwrite what is in it", () => {
    const calls: string[] = [];
    const s: KeptStorage = {
      getItem: (k) => {
        if (k === KEPT_KEY) throw new Error("blocked");
        return saved;
      },
      setItem: (k) => { calls.push(k); },
    };
    expect(migrateSavedPlaces(s, 1)).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("a failed write leaves the saved places to be migrated next time", () => {
    const full = memory({ [SAVED_KEY]: saved }, 20);
    expect(migrateSavedPlaces(full, 1)).toEqual([]);
    const later = memory({ [SAVED_KEY]: saved });
    expect(migrateSavedPlaces(later, 1)).toHaveLength(2);
  });

  it("ignores saved entries that are not places", () => {
    const s = memory({ [SAVED_KEY]: JSON.stringify([torino, { lat: "x" }, "junk", { lat: 1, lon: 1 }]) });
    expect(migrateSavedPlaces(s, 1).map((r) => r.place.name)).toEqual(["Torino"]);
  });
});
