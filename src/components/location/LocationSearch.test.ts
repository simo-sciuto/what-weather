import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }) }));
vi.mock("../time/TimeContext", () => ({ useMoment: () => ({}) }));
vi.mock("./PlaceContext", () => ({
  usePlace: () => ({
    place: { name: "Torino", lat: 45.07, lon: 7.68, region: "Piemonte", country: "Italia" },
    searchRef: { current: null },
    saved: [],
    isSaved: false,
    toggleSaved: () => undefined,
    recent: [],
  }),
}));

const { LocationSearch } = await import("./LocationSearch");

/** The server's HTML, which is what a phone paints before any script has run */
const html = renderToString(createElement(LocationSearch));

describe("the city search before the page's script runs (WTH-165)", () => {
  const field = /<div class="flex h-12 items-center gap-3 rounded-full[^"]*"/.exec(html)?.[0] ?? "";
  const container = /<div class="[^"]*"[^>]*><button/.exec(html)?.[0] ?? "";

  it("paints a phone's round button in the server's HTML, hidden from a computer, so the page is born with it", () => {
    const button = /<button type="button" tabindex="-1" aria-hidden="true" class="[^"]*lg:hidden"/.exec(html)?.[0];
    expect(button, "a button for phones only").toBeDefined();
    expect(button).toContain("size-11");
    expect(button).toContain("rounded-full");
  });

  it("hides the field itself on a phone from the first paint, unseen and untouched, though still in the page to focus", () => {
    expect(field).toContain("max-lg:opacity-0");
    expect(field).toContain("max-lg:pointer-events-none");
    // Not taken out of the layout: a field that is not rendered cannot take focus inside the tap that opens it
    expect(field).not.toContain("max-lg:hidden");
    expect(field).not.toContain("max-lg:sr-only");
    expect(field).not.toContain("max-lg:absolute");
  });

  it("keeps a computer's field as it was: the whole field, in the page, with no phone styling on its container's box", () => {
    expect(field).toContain("glass");
    expect(container).toContain("lg:relative");
  });

  it("holds the folded field in the very box it opens in, so the focus moves nothing on a phone", () => {
    for (const cls of ["max-lg:fixed", "max-lg:inset-x-4", "max-lg:top-[max(1rem,env(safe-area-inset-top))]", "max-lg:z-50"]) expect(container, cls).toContain(cls);
    // Touches pass through the folded box to the poster; only the button takes them
    expect(container).toContain("max-lg:pointer-events-none");
    expect(html).toContain("pointer-events-auto");
  });

  it("gives the typed text its own colour, so no inheritance can leave it unseen", () => {
    expect(html).toMatch(/<input[^>]*class="[^"]*\btext-ink\b[^"]*"/);
    expect(html).toMatch(/<input[^>]*class="[^"]*caret-accent/);
    expect(html).toMatch(/<input[^>]*class="[^"]*\btext-base\b/);
  });

  it("keeps the field reachable for keyboards and readers: labelled, a combobox, with its placeholder", () => {
    expect(html).toContain('role="combobox"');
    expect(html).toContain("Cerca località");
    expect(html).toContain('placeholder="Cerca una città"');
  });
});
