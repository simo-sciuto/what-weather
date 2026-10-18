"use client";

import type { CameraPort, PointSky } from "@/types/atlas";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Wordmark } from "../Wordmark";
import { AtlasMap } from "./AtlasMap";
import { AtlasSearch } from "./AtlasSearch";
import { ATLAS_SKY, paletteVars } from "./atlas-look";
import { countRender } from "./atlas-test";
import { CenterReadout } from "./CenterReadout";
import { Crosshair } from "./Crosshair";
import { PointReading } from "./PointReading";
import { SkyDriver } from "./SkyDriver";
import { useAtlasEngine } from "./useAtlasEngine";

/**
 * The Atlas's persistent shell, mounted by `app/atlas/layout.tsx`, so it outlives every navigation inside the route
 * (ADR-020, M3): the sky of the home page, the map, the crosshair, the centre's coordinates and the way back, with the
 * route's own content (`children`) beside them, read by screen readers and drawn by nobody. The camera port is held
 * here once the map is made, and passed to the parts that listen to it; it changes twice in the life of the shell, not
 * with the camera.
 */
export function AtlasShell({ children }: { children: ReactNode }) {
  countRender("shell");
  const [port, setPort] = useState<CameraPort | null>(null);
  const [sky, setSky] = useState<PointSky>(ATLAS_SKY);
  const vars = useMemo(() => paletteVars(sky), [sky]);
  const { engine, goTo } = useAtlasEngine(port);

  return (
    <div data-atlas className="atmosphere h-dvh w-full select-none overflow-hidden overscroll-none" style={vars}>
      <AtlasMap onPort={setPort} sky={sky} />
      <SkyDriver port={port} engine={engine} onSky={setSky} />
      <Crosshair port={port} />
      <Link
        href="/"
        className="absolute left-[max(1rem,env(safe-area-inset-left))] top-[max(1rem,env(safe-area-inset-top))] z-10 text-[1.375rem] text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        <Wordmark />
      </Link>
      <AtlasSearch onChoose={(place) => goTo(place)} />
      <PointReading engine={engine} port={port} />
      <CenterReadout port={port} />
      <main className="sr-only">{children}</main>
    </div>
  );
}
