"use client";

import type { CameraPort, PointSky } from "@/types/atlas";
import type { Map as MapboxMap } from "mapbox-gl";
import { uiTokens } from "@/lib/weather/ui-tokens";
import { createTimeStore } from "@/lib/atlas/time-store";
import { readMoment, selectionOfAddress } from "@/lib/weather/moment-address";
import { createAddressWriter } from "@/lib/atlas/address";
import { inRegion } from "@/lib/atlas/layers";
import { NOW_SELECTION } from "@/lib/weather/instant";
import { AddressSync } from "./AddressSync";
import { useCallback, useMemo, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { AtlasMap } from "./AtlasMap";
import { AtlasMapPanel } from "./AtlasMapPanel";
import { WeatherFieldLayer } from "./WeatherFieldLayer";
import { AtlasSearch } from "./AtlasSearch";
import { WordmarkLink } from "./WordmarkLink";
import { ATLAS_SKY, useAtlasMapLook } from "./atlas-look";
import { countRender } from "./atlas-test";
import { CenterReadout } from "./CenterReadout";
import { Crosshair } from "./Crosshair";
import { PointReading } from "./PointReading";
import { SkyDriver, type SunAt } from "./SkyDriver";
import { TimeBar } from "./TimeBar";
import { LayerSwitch } from "./LayerSwitch";
import { createLayerStore, layerPlan, readLayer, type AtlasLayer } from "@/lib/atlas/layers";
import { useMapOptions } from "./MapPanel";
import { useAtlasPoint } from "./useAtlasTime";
import { useAtlasEngine } from "./useAtlasEngine";

/**
 * The Atlas's persistent shell, mounted by `app/(atlas)/layout.tsx`, so it outlives every navigation inside the route
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
  // The layer on show (WTH-346), from the address once the browser has it; Meteo on the server
  const [layers] = useState(() => createLayerStore(typeof window === "undefined" ? "meteo" : readLayer(window.location.search)));
  const chosen = useSyncExternalStore(layers.subscribe, layers.get, () => "meteo" as AtlasLayer);
  // The one writer of the address (point, moment, layer), made once
  const [address] = useState(() => createAddressWriter(() => window.location.search.replace(/^\?/, "")));
  const { engine, goTo } = useAtlasEngine(port, address);
  // Away from the region Territorio and Percorsi have no data: the map is Meteo there, the choice is kept for coming back
  const point = useAtlasPoint(engine);
  const layer: AtlasLayer = point && !inRegion(point.cell.lat, point.cell.lon) ? "meteo" : chosen;
  const own = useMapOptions();
  const plan = useMemo(() => layerPlan(layer, own), [layer, own]);
  const override = layer === "meteo" ? undefined : plan.options;
  // The map panel and the search share the right of the screen: opening the search puts the panel away
  const [panelOpen, setPanelOpen] = useState(false);
  const [fieldColors, setFieldColors] = useState<readonly string[]>([]);
  const { inks } = useAtlasMapLook(sky, override);
  // The interface's colours: the sky of the point on show, and surfaces measured against the field and the inks under them
  const tokens = useMemo(
    () => uiTokens(sky, fieldColors, Object.values(inks).map((ink) => ink.color), { field: plan.fieldOpacity, tint: plan.tintOpacity }),
    [sky, fieldColors, inks, plan],
  );
  const vars = tokens as unknown as CSSProperties;

  const chooseLayer = useCallback((next: AtlasLayer) => layers.set(next), [layers]);
  const onChoose = useCallback((place: { lat: number; lon: number }) => goTo(place), [goTo]);
  const onOpen = useCallback(() => setPanelOpen(false), []);
  // The wordmark starts again: Adesso, Meteo, and the address from scratch
  const startAgain = useCallback(() => {
    address.reset();
    time.set(NOW_SELECTION);
    layers.set("meteo");
  }, [address, time, layers]);

  return (
    <div data-atlas className="atmosphere h-dvh w-full select-none overflow-hidden overscroll-none" style={{ ...vars, "--dock-room": "max(0.75rem, env(safe-area-inset-bottom))" } as CSSProperties}>
      <AtlasMap onPort={setPort} onMap={setMap} sky={sky} sunAt={sunAt} options={override} />
      <AddressSync address={address} time={time} layers={layers} />
      <WeatherFieldLayer map={map} port={port} onColors={setFieldColors} store={time} opacity={plan.fieldOpacity} tint={plan.tintOpacity} />
      <SkyDriver port={port} engine={engine} store={time} onSky={setSky} onSun={setSunAt} />
      <Crosshair port={port} />
      <WordmarkLink onStartAgain={startAgain} />
      <AtlasMapPanel sky={sky} tokens={vars} open={panelOpen} onOpenChange={setPanelOpen} />
      <AtlasSearch onChoose={onChoose} onOpen={onOpen} />
      <PointReading engine={engine} port={port} store={time} />
      <LayerSwitch engine={engine} layer={layer} chosen={chosen} onLayer={chooseLayer} />
      <TimeBar engine={engine} store={time} />
      <CenterReadout port={port} />
      <main className="sr-only">{children}</main>
    </div>
  );
}
