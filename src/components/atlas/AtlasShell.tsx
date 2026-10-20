"use client";

import type { CameraPort, PointSky } from "@/types/atlas";
import type { Map as MapboxMap } from "mapbox-gl";
import { uiTokens } from "@/lib/weather/ui-tokens";
import { createTimeStore } from "@/lib/atlas/time-store";
import { readMoment, selectionOfAddress, withMoment } from "@/lib/weather/moment-address";
import { MOMENT_ADDRESS_DELAY_MS } from "@/constants/atlas";
import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { AtlasMap } from "./AtlasMap";
import { AtlasMapPanel } from "./AtlasMapPanel";
import { WeatherFieldLayer } from "./WeatherFieldLayer";
import { AtlasSearch } from "./AtlasSearch";
import { WordmarkLink } from "./WordmarkLink";
import { AtlasDock } from "../nav/AtlasDock";
import { ATLAS_SKY, useAtlasMapLook } from "./atlas-look";
import { countRender } from "./atlas-test";
import { CenterReadout } from "./CenterReadout";
import { Crosshair } from "./Crosshair";
import { PointReading } from "./PointReading";
import { SkyDriver, type SunAt } from "./SkyDriver";
import { TimeBar } from "./TimeBar";
import { LayerSwitch } from "./LayerSwitch";
import { createLayerStore, layerPlan, readLayer, withLayer, type AtlasLayer } from "@/lib/atlas/layers";
import { useMapOptions } from "./MapPanel";
import { useAtlasTime } from "./useAtlasTime";
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
  const [sunAt, setSunAt] = useState<SunAt | null>(null);
  // The moment the whole Atlas shows (WTH-343), read once from the address; "Adesso" on the server
  const [time] = useState(() => createTimeStore(typeof window === "undefined" ? undefined : selectionOfAddress(readMoment(window.location.search))));
  const selection = useAtlasTime(time);
  // The layer on show (WTH-346), from the address once the browser has it; Meteo on the server
  const [layers] = useState(() => createLayerStore(typeof window === "undefined" ? "meteo" : readLayer(window.location.search)));
  const layer = useSyncExternalStore(layers.subscribe, layers.get, () => "meteo" as AtlasLayer);
  const own = useMapOptions();
  const plan = useMemo(() => layerPlan(layer, own), [layer, own]);
  const override = layer === "meteo" ? undefined : plan.options;
  // The map panel and the search share the right of the screen: opening the search puts the panel away
  const [panelOpen, setPanelOpen] = useState(false);
  const [fieldColors, setFieldColors] = useState<readonly string[]>([]);
  const { inks } = useAtlasMapLook(sky, override);
  // The interface's colours: the sky of the point on show, and surfaces measured against the field and the inks under them
  const tokens = useMemo(() => uiTokens(sky, fieldColors, Object.values(inks).map((ink) => ink.color)), [sky, fieldColors, inks]);
  const vars = tokens as unknown as CSSProperties;
  const { engine, goTo } = useAtlasEngine(port);

  // The layer goes into the address at once: a link opens on it, Meteo takes it out
  const chooseLayer = (next: AtlasLayer) => {
    layers.set(next);
    const query = withLayer(window.location.search, next);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  };

  // The moment goes into the address after a pause, so a link opens on it; "Adesso" takes it out. Native history: the
  // page renders no weather, and the router's own navigations keep the parameter (they start from the address)
  useEffect(() => {
    const id = window.setTimeout(() => {
      const next = withMoment(window.location.search, selection);
      if (next !== window.location.search.replace(/^\?/, "")) window.history.replaceState(window.history.state, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
    }, MOMENT_ADDRESS_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [selection]);

  return (
    <div data-atlas className="atmosphere h-dvh w-full select-none overflow-hidden overscroll-none" style={vars}>
      <AtlasMap onPort={setPort} onMap={setMap} sky={sky} sunAt={sunAt} options={override} />
      <WeatherFieldLayer map={map} port={port} onColors={setFieldColors} instant={selection.mode === "at" ? selection.instant : null} opacity={plan.fieldOpacity} tint={plan.tintOpacity} />
      <SkyDriver port={port} engine={engine} store={time} onSky={setSky} onSun={setSunAt} />
      <Crosshair port={port} />
      <WordmarkLink engine={engine} />
      <AtlasMapPanel sky={sky} tokens={vars} open={panelOpen} onOpenChange={setPanelOpen} />
      <AtlasSearch onChoose={(place) => goTo(place)} onOpen={() => setPanelOpen(false)} />
      <PointReading engine={engine} port={port} store={time} />
      <LayerSwitch engine={engine} layer={layer} onLayer={chooseLayer} />
      <TimeBar engine={engine} store={time} />
      <CenterReadout port={port} />
      <AtlasDock engine={engine} />
      <main className="sr-only">{children}</main>
    </div>
  );
}
