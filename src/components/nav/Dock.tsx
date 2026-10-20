"use client";

import type { Section } from "@/lib/sections";
import Link from "next/link";
import type { MouseEvent } from "react";
import { useHydrated } from "../useHydrated";
import { SECTION_DEFS } from "./sections";

/**
 * One entry of the bar. With `onSelect` it is a link that changes the section inside the page (its `href` still
 * works for a new tab or a copied link); without it, an ordinary link to another address.
 */
export type DockItem = { id: Section; href: string; onSelect?: () => void };

const ORDER: Section[] = ["meteo", "esplora", "crea"];

/** A click the browser should handle itself: a new tab, a new window, a download */
const own = (e: MouseEvent) => e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

/**
 * The bar (ADR-029): a capsule of glass at the foot of the screen with the three sections as three real links in a
 * `nav`, not tabs (a section has an address). The current one has `aria-current="page"` and a lighter drop of glass.
 * The glass is its own layer, a sibling of the drop and of the links and never their parent: a filter, an opacity or a
 * transform on the element that blurs what is behind it would break the blur. Its look, its fallbacks (no blur, less
 * transparency, more contrast, forced colours) and its room (`--dock-room`) are in globals.css. In D3 the drop does
 * not move; the transition between sections is D4's, and `view-transition-name: dock` is already on the capsule.
 */
export function Dock({ current, items }: { current: Section; items: readonly DockItem[] }) {
  const hydrated = useHydrated();
  return (
    <nav aria-label="Sezioni" data-dock data-ready={hydrated ? "true" : "false"} className="dock">
      <span aria-hidden="true" className="dock-glass" />
      <ul className="dock-list">
        {ORDER.map((id) => {
          const item = items.find((i) => i.id === id);
          if (!item) return null;
          const { label, icon } = SECTION_DEFS[id];
          const props = {
            href: item.href,
            "aria-current": current === id ? ("page" as const) : undefined,
            "data-dock-item": id,
            className: "dock-item",
          };
          const body = (
            <>
              <span aria-hidden="true" className="dock-drop" />
              {icon}
              <span className="dock-label">{label}</span>
            </>
          );
          return (
            <li key={id} className="dock-cell">
              {item.onSelect ? (
                <a
                  {...props}
                  onClick={(e) => {
                    if (own(e)) return;
                    e.preventDefault();
                    item.onSelect?.();
                  }}
                >
                  {body}
                </a>
              ) : (
                <Link {...props}>{body}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
