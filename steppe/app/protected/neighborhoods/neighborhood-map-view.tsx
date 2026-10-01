"use client";

import { useEffect, useId, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./neighborhood-map.css";
import { Button } from "@/components/ui/button";
import { t, type Dictionary } from "@/lib/i18n";
import data from "../../../public/maps/redmond-2019/map.json";

type Mode = "aerial" | "streets" | "compare";
type Copy = Dictionary["neighborhoods"]["map"];
const anchors: Record<string, Leaflet.LatLngTuple> = Object.fromEntries(
  Object.entries(data.anchors).map(([name, [lat, lng]]) => [name, [lat, lng]]),
);
const bounds = data.bounds as [[number, number], [number, number]];

/** This component is imported only after Explore; no location/GPS or geocoding. */
export function NeighborhoodMapView({
  copy,
  names,
  selectedName,
  onError,
}: {
  copy: Copy;
  names: string[];
  selectedName?: string;
  onError: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const live = useRef<{
    map: Leaflet.Map;
    aerial: Leaflet.ImageOverlay;
    streets: Leaflet.TileLayer;
    L: typeof Leaflet;
    marker?: Leaflet.CircleMarker;
  } | null>(null);
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("aerial");
  const [focusName, setFocusName] = useState(selectedName ?? "");
  const [tileError, setTileError] = useState(false);
  const selectId = useId();
  const helpId = useId();
  const initialCopy = useRef(copy);

  useEffect(() => {
    let disposed = false;
    let map: Leaflet.Map | undefined;
    let resize: ResizeObserver | undefined;
    import("leaflet")
      .then((L) => {
        if (disposed || !container.current) return;
        const c = initialCopy.current;
        map = L.map(container.current, {
          zoomControl: false,
          attributionControl: true,
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
          scrollWheelZoom: false,
          minZoom: 11,
          maxZoom: 17,
          maxBounds: L.latLngBounds(bounds).pad(0.35),
          maxBoundsViscosity: 1,
        });
        map.attributionControl.setPrefix(false);
        const aerial = L.imageOverlay(
          "/maps/redmond-2019/aerial.webp",
          bounds,
          { alt: c.alt },
        );
        aerial.on("load", () => {
          if (!disposed) {
            setReady(true);
            container.current?.focus({ preventScroll: true });
          }
        });
        aerial.on("error", () => {
          if (!disposed) errorRef.current();
        });
        aerial.addTo(map);
        // Creating the layer makes no network request. Add it only on explicit choice.
        const streets = L.tileLayer(
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            updateWhenIdle: true,
            keepBuffer: 0,
            referrerPolicy: "strict-origin-when-cross-origin",
          },
        );
        streets.on("tileerror", () => {
          if (!disposed) setTileError(true);
        });
        live.current = { map, aerial, streets, L };
        map.fitBounds(bounds, { padding: [8, 8], animate: false });
        resize = new ResizeObserver(() => {
          map?.invalidateSize({ pan: false });
        });
        resize.observe(container.current);
      })
      .catch(() => {
        if (!disposed) errorRef.current();
      });
    return () => {
      disposed = true;
      resize?.disconnect();
      live.current = null;
      map?.remove();
    };
  }, []);

  useEffect(() => {
    setFocusName(selectedName ?? "");
  }, [selectedName]);

  useEffect(() => {
    const ctx = live.current;
    if (!ctx || !ready) return;
    ctx.marker?.remove();
    ctx.marker = undefined;
    const point = anchors[focusName];
    if (!point) {
      ctx.map.fitBounds(bounds, { padding: [8, 8], animate: false });
      return;
    }
    ctx.marker = ctx.L.circleMarker(point, {
      radius: 12,
      color: "#fff",
      weight: 3,
      fillColor: "#172c45",
      fillOpacity: 1,
    }).addTo(ctx.map);
    // TextContent avoids treating names as HTML. An outside status carries the label.
    const label = document.createElement("span");
    label.textContent = focusName;
    ctx.marker.bindTooltip(label, {
      direction: "top",
      permanent: true,
      offset: [0, -12],
    });
    ctx.map.setView(point, 15, { animate: false });
  }, [focusName, ready]);

  function changeMode(next: Mode) {
    const ctx = live.current;
    if (!ctx) return;
    setMode(next);
    setTileError(false);
    if (next === "aerial") ctx.streets.remove();
    else if (!ctx.map.hasLayer(ctx.streets)) ctx.streets.addTo(ctx.map);
    if (next === "streets") ctx.aerial.remove();
    else {
      if (!ctx.map.hasLayer(ctx.aerial)) ctx.aerial.addTo(ctx.map);
      ctx.aerial.setOpacity(next === "compare" ? 0.6 : 1);
      ctx.aerial.bringToFront();
    }
  }

  function reset() {
    setFocusName("");
    live.current?.marker?.remove();
    live.current?.map.fitBounds(bounds, { padding: [8, 8], animate: false });
  }

  return (
    <div className="neighborhood-map space-y-3">
      <div className="space-y-1">
        <label htmlFor={selectId} className="text-sm font-medium">
          {copy.find}
        </label>
        <select
          id={selectId}
          value={focusName}
          onChange={(e) => setFocusName(e.target.value)}
          disabled={!ready}
          className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">{copy.wholeMap}</option>
          {names.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={copy.layers}
      >
        {(["aerial", "streets", "compare"] as const).map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            className="min-h-11"
            variant={mode === value ? "default" : "outline"}
            aria-pressed={mode === value}
            disabled={!ready}
            onClick={() => changeMode(value)}
          >
            {copy[value]}
          </Button>
        ))}
      </div>
      <p id={helpId} className="text-sm text-muted-foreground">
        {copy.help}
      </p>
      {!ready && (
        <p role="status" className="text-sm">
          {copy.loading}
        </p>
      )}
      {focusName && (
        <p role="status" className="text-sm">
          {t(anchors[focusName] ? copy.located : copy.missing, {
            name: focusName,
          })}
        </p>
      )}
      {mode !== "aerial" && (
        <p className="text-sm text-muted-foreground">{copy.streetPrivacy}</p>
      )}
      {tileError && (
        <p role="alert" className="text-sm text-destructive">
          {copy.streetError}
        </p>
      )}
      <div
        ref={container}
        role="region"
        aria-label={copy.region}
        aria-describedby={helpId}
        className="map-canvas h-[26rem] w-full rounded-md border sm:h-[32rem]"
      />
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={copy.navigation}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          disabled={!ready}
          onClick={() => live.current?.map.zoomIn()}
        >
          {copy.zoomIn}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          disabled={!ready}
          onClick={() => live.current?.map.zoomOut()}
        >
          {copy.zoomOut}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          disabled={!ready}
          onClick={reset}
        >
          {copy.reset}
        </Button>
      </div>
      {/* Always-visible attribution outside the pannable image; retained in every mode. */}
      <p className="text-xs text-muted-foreground">
        {copy.aerialCredit}
        {mode !== "aerial" && (
          <>
            {" "}
            · ©{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener"
              className="underline"
            >
              OpenStreetMap
            </a>{" "}
            {copy.contributors}
          </>
        )}
      </p>
      <p className="text-sm text-muted-foreground">{copy.selectionHint}</p>
    </div>
  );
}
