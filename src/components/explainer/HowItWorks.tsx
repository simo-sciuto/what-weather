"use client";

import { useEffect, useRef } from "react";
import { Explainer, type ExplainerLinks } from "./Explainer";
import type { FilmCity } from "./Stage";

/**
 * "Come funziona" in its own window over the page: the film, played from its start each time it is opened. A native modal
 * dialog, so the keyboard stays inside it, Escape closes it and the focus goes back to what opened it; a click on the
 * dark around it closes it too. Nothing of the film exists while it is shut: it is made when it opens and gone when it closes.
 */
export function HowItWorks({ open, onClose, city, links }: { open: boolean; onClose: () => void; city: FilmCity; links: ExplainerLinks }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-label="Come funziona"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
      className="m-auto w-[min(76rem,calc(100vw-2rem),calc((100dvh-9.5rem)*1.7778))] max-w-none overflow-visible border-0 bg-transparent p-0 text-ink backdrop:bg-black/80 backdrop:backdrop-blur-sm"
    >
      {open && <Explainer city={city} links={links} onClose={onClose} />}
    </dialog>
  );
}
