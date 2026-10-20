"use client";

import { MOMENT_ADDRESS_DELAY_MS } from "@/constants/atlas";
import type { AddressWriter } from "@/lib/atlas/address";
import type { LayerStore } from "@/lib/atlas/layers";
import { readLayer } from "@/lib/atlas/layers";
import type { TimeStore } from "@/lib/atlas/time-store";
import { readMoment, selectionOfAddress, withMoment } from "@/lib/weather/moment-address";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef } from "react";

/**
 * Keeps the moment and the layer and the address together (WTH-343, WTH-346, the reviewer's I1 and I2), drawing
 * nothing: a moment the time bar rests on goes into the address after a pause, a layer at once, both through the one
 * address writer and the router; Back and Forward bring the address's moment and layer back to the stores. It listens
 * to the stores on its own, so moving the time bar renders nothing here and not the shell.
 */
export function AddressSync({ address, time, layers }: { address: AddressWriter; time: TimeStore; layers: LayerStore }) {
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    const write = (query: string) => startTransition(() => routerRef.current.replace(`/${query ? `?${query}` : ""}`, { scroll: false }));
    let timer: number | undefined;
    const stopTime = time.subscribe(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const current = address.current();
        const next = withMoment(current, time.get());
        if (next !== current) write(address.next((params) => {
          params.delete("t");
          new URLSearchParams(next).forEach((value, key) => key === "t" && params.set("t", value));
        }));
      }, MOMENT_ADDRESS_DELAY_MS);
    });
    const stopLayer = layers.subscribe(() => {
      const layer = layers.get();
      write(address.next((params) => (layer === "meteo" ? params.delete("strato") : params.set("strato", layer))));
    });
    // Back and Forward: the address is the location again, and the moment and the layer follow it
    const onPop = () => {
      address.reset();
      window.clearTimeout(timer);
      time.set(selectionOfAddress(readMoment(window.location.search)));
      layers.set(readLayer(window.location.search));
    };
    window.addEventListener("popstate", onPop);
    return () => {
      stopTime();
      stopLayer();
      window.clearTimeout(timer);
      window.removeEventListener("popstate", onPop);
    };
  }, [address, time, layers]);

  return null;
}
