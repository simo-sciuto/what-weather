import { describe, expect, it } from "vitest";
import { KEPT_SHOWN, keptHref, keptList } from "./kept-view";
import type { KeptRecord } from "./kept-record";

const record = (n: number, t: number | null = null): KeptRecord => ({
  id: `r${n}`,
  place: { lat: 45.07, lon: 7.69, name: "Torino" },
  t,
  format: "a4",
  createdAt: 1_000_000_000 + n,
});

describe("the list Keep shows", () => {
  it("shows all of a few records, newest first, with nothing behind", () => {
    const list = keptList([record(1), record(3), record(2)]);
    expect(list.latest.map((r) => r.id)).toEqual(["r3", "r2", "r1"]);
    expect(list.rest).toEqual([]);
    expect(list.total).toBe(3);
  });

  it("shows the newest three of many, and keeps the others for the list that opens", () => {
    const list = keptList([1, 2, 3, 4, 5].map((n) => record(n)));
    expect(list.latest.map((r) => r.id)).toEqual(["r5", "r4", "r3"]);
    expect(list.rest.map((r) => r.id)).toEqual(["r2", "r1"]);
    expect(list.total).toBe(5);
    expect(KEPT_SHOWN).toBe(3);
  });

  it("is empty when nothing is kept", () => {
    expect(keptList([])).toEqual({ latest: [], rest: [], total: 0 });
  });
});

describe("the address of a record", () => {
  it("is the place alone for Adesso, and the place at its moment otherwise", () => {
    expect(keptHref(record(1))).toBe("/?lat=45.0700&lon=7.6900&name=Torino");
    expect(keptHref(record(1, 1_792_418_400))).toBe("/?lat=45.0700&lon=7.6900&name=Torino&t=1792418400");
  });
});
