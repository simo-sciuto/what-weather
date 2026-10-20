"use client";

import { memo } from "react";
import Link from "next/link";
import { Wordmark } from "../Wordmark";

/**
 * The site's name, as a way to start again: the atlas with nothing chosen, on the region, at "Adesso", in Meteo.
 */
export const WordmarkLink = memo(function WordmarkLink({ onStartAgain }: { onStartAgain: () => void }) {
  return (
    <Link
      href="/"
      onClick={onStartAgain}
      className="absolute left-[max(1rem,env(safe-area-inset-left))] top-[max(1rem,env(safe-area-inset-top))] z-10 text-[1.375rem] text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
    >
      <Wordmark />
    </Link>
  );
});
