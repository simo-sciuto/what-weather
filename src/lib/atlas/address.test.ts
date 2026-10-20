import { describe, expect, it } from "vitest";
import { createAddressWriter } from "./address";

describe("createAddressWriter", () => {
  it("builds each change on the last one asked for, not on a location that has not caught up", () => {
    let location = "lat=45.07&lon=7.69";
    const writer = createAddressWriter(() => location);
    // a stop asks for a new point; the navigation is in flight, the location still says the old one
    expect(writer.next((p) => (p.set("lat", "44.41"), p.set("lon", "8.93")))).toBe("lat=44.41&lon=8.93");
    // the time bar writes its moment meanwhile: the new point stays
    expect(writer.next((p) => p.set("t", "1792500000"))).toBe("lat=44.41&lon=8.93&t=1792500000");
    expect(writer.next((p) => p.set("strato", "territorio"))).toBe("lat=44.41&lon=8.93&t=1792500000&strato=territorio");
    location = "x=1";
    expect(writer.next((p) => p.delete("t"))).toBe("lat=44.41&lon=8.93&strato=territorio");
  });

  it("starts again from the location once reset (Back, Forward)", () => {
    let location = "lat=1&lon=2";
    const writer = createAddressWriter(() => location);
    writer.next((p) => p.set("t", "5"));
    location = "lat=3&lon=4";
    writer.reset();
    expect(writer.next((p) => p.set("strato", "percorsi"))).toBe("lat=3&lon=4&strato=percorsi");
  });
});
