"use client";

import type { CameraPort, PointSky } from "@/types/atlas";
import type { Map as MapboxMap } from "mapbox-gl";
import { useMemo, useState, type ReactNode } from "react";
import { AtlasMap } from "./AtlasMap";
import { AtlasMapPanel } from "./AtlasMapPanel";
import { WeatherFieldLayer } from "./WeatherFieldLayer";
import { AtlasSearch } from "./AtlasSearch";
import { WordmarkLink } from "./WordmarkLink";
import { AtlasDock } from "../nav/AtlasDock";
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
  const [map, setMap] = useState<MapboxMap | null>(null);
  const [sky, setSky] = useState<PointSky>(ATLAS_SKY);
  // The map panel and the search share the right of the screen: opening the search puts the panel away
  const [panelOpen, setPanelOpen] = useState(false);
  const vars = useMemo(() => paletteVars(sky), [sky]);
  const { engine, goTo } = useAtlasEngine(port);

  return (
    <div data-atlas className="atmosphere h-dvh w-full select-none overflow-hidden overscroll-none" style={vars}>
      <AtlasMap onPort={setPort} onMap={setMap} sky={sky} />
      <WeatherFieldLayer map={map} port={port} />
      <SkyDriver port={port} engine={engine} onSky={setSky} />
      <Crosshair port={port} />
      <WordmarkLink engine={engine} />
      <AtlasMapPanel sky={sky} open={panelOpen} onOpenChange={setPanelOpen} />
      <AtlasSearch onChoose={(place) => goTo(place)} onOpen={() => setPanelOpen(false)} />
      <PointReading engine={engine} port={port} />
      <CenterReadout port={port} />
      <AtlasDock engine={engine} />
      <main className="sr-only">{children}</main>
    </div>
  );
}
