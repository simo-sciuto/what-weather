"use client";

import { placeRefOf } from "@/lib/atlas/links";
import type { AtlasEngine } from "@/lib/atlas/engine";
import { placeHref } from "@/lib/place";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Wordmark } from "../Wordmark";

/**
 * The way back to the weather page: the wordmark, as on every page of the site, and to the weather of the place the Atlas
 * has on show once there is one (the path Explore, Atlas, Create keeps the place), to the front page before that.
 */
export function WordmarkLink({ engine }: { engine: AtlasEngine | null }) {
  const point = useSyncExternalStore(
    (listener) => engine?.subscribe(listener) ?? (() => {}),
    () => engine?.getSnapshot().point ?? null,
    () => null,
  );
  return (
    <Link
      href={point ? placeHref(placeRefOf(point)) : "/"}
      className="absolute left-[max(1rem,env(safe-area-inset-left))] top-[max(1rem,env(safe-area-inset-top))] z-10 text-[1.375rem] text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
    >
      <Wordmark />
    </Link>
  );
}
