"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./neighborhood-map.css";
import { Button } from "@/components/ui/button";
import { t, type Dictionary } from "@/lib/i18n";
import type { AddressPoint } from "@/lib/neighborhood-address";
import {
  coveredByPickerMap,
  pickerMapBounds,
  subdivisionCatalog,
  subdivisionsAtPoint,
  validSubdivisionOutlines,
  type SubdivisionOutlines,
} from "@/lib/subdivision-outlines";
import historical from "../../../public/maps/redmond-2019/map.json";

type Mode = "outlines" | "streets" | "aerial" | "compare";
type Copy = Dictionary["neighborhoods"]["map"];
const anchors: Record<string, Leaflet.LatLngTuple> = Object.fromEntries(
  Object.entries(historical.anchors).map(([name, [lat, lng]]) => [
    name,
    [lat, lng],
  ]),
);
const countyNames = new Map(
  subdivisionCatalog.neighborhoods.map((row) => [row.name, row]),
);
const outlineStyle = {
  color: "#234c39",
  weight: 2,
  fillColor: "#c6d7ca",
  fillOpacity: 0.2,
};
const selectedStyle = {
  color: "#172c45",
  weight: 4,
  fillColor: "#c6d7ca",
  fillOpacity: 0.45,
};

/** Loads only public snapshot geometry; address coordinates stay in memory. */
export function NeighborhoodMapView({
  copy,
  names,
  selectedName,
  address,
  onChooseName,
  onError,
}: {
  copy: Copy;
  names: string[];
  selectedName?: string;
  address?: AddressPoint;
  onChooseName: (name: string) => void;
  onError: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const live = useRef<{
    map: Leaflet.Map;
    aerial: Leaflet.ImageOverlay;
    streets: Leaflet.TileLayer;
    L: typeof Leaflet;
    outlines?: Leaflet.GeoJSON;
    labelLayer?: Leaflet.Layer;
    marker?: Leaflet.CircleMarker;
    addressMarker?: Leaflet.CircleMarker;
  } | null>(null);
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("outlines");
  const [focusName, setFocusName] = useState(selectedName ?? "");
  const [outlines, setOutlines] = useState<SubdivisionOutlines | null>(null);
  const [outlineError, setOutlineError] = useState(false);
  const [aerialError, setAerialError] = useState(false);
  const [tileError, setTileError] = useState(false);
  const selectId = useId();
  const helpId = useId();
  const initialCopy = useRef(copy);
  const matchingNames = useMemo(
    () => (outlines && address ? subdivisionsAtPoint(outlines, address) : []),
    [outlines, address],
  );
  const searchableNames = useMemo(
    () =>
      [...new Set([...names, ...countyNames.keys()])].sort((a, b) =>
        a.localeCompare(b),
      ),
    [names],
  );

  useEffect(() => {
    let disposed = false;
    let map: Leaflet.Map | undefined;
    let resize: ResizeObserver | undefined;
    const controller = new AbortController();
    import("leaflet")
      .then(async (L) => {
        if (disposed || !container.current) return;
        map = L.map(container.current, {
          zoomControl: false,
          attributionControl: true,
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
          scrollWheelZoom: false,
          minZoom: 11,
          maxZoom: 18,
          maxBounds: L.latLngBounds(pickerMapBounds).pad(0.35),
          maxBoundsViscosity: 1,
        });
        map.attributionControl.setPrefix(false);
        // Neither historical imagery nor external tiles load until explicitly chosen.
        const aerial = L.imageOverlay(
          "/maps/redmond-2019/aerial.webp",
          historical.bounds as [[number, number], [number, number]],
          { alt: initialCopy.current.alt },
        );
        aerial.on("error", () => {
          if (!disposed) setAerialError(true);
        });
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
        const ctx = { map, aerial, streets, L } as NonNullable<
          typeof live.current
        >;
        live.current = ctx;
        map.fitBounds(pickerMapBounds, { padding: [8, 8], animate: false });
        resize = new ResizeObserver(() => map?.invalidateSize({ pan: false }));
        resize.observe(container.current);
        try {
          const response = await fetch(
            `/maps/redmond-current/outlines.geojson?v=${subdivisionCatalog.geometrySha256.slice(0, 12)}`,
            { signal: controller.signal },
          );
          if (!response.ok) throw new Error("Outline snapshot unavailable");
          const data: unknown = await response.json();
          if (!validSubdivisionOutlines(data))
            throw new Error("Invalid outline snapshot");
          if (disposed) return;
          ctx.outlines = L.geoJSON(data, {
            style: outlineStyle,
            onEachFeature(feature, layer) {
              const label = document.createElement("span");
              label.textContent = feature.properties.name;
              layer.bindTooltip(label, { sticky: true });
              layer.on("click", () => setFocusName(feature.properties.name));
            },
          }).addTo(map);
          setOutlines(data);
        } catch {
          if (!disposed) setOutlineError(true);
        }
        if (!disposed) {
          setReady(true);
          container.current?.focus({ preventScroll: true });
        }
      })
      .catch(() => {
        if (!disposed) errorRef.current();
      });
    return () => {
      disposed = true;
      controller.abort();
      resize?.disconnect();
      live.current = null;
      map?.remove();
    };
  }, []);

  useEffect(() => setFocusName(selectedName ?? ""), [selectedName]);

  useEffect(() => {
    const ctx = live.current;
    if (!ctx || !ready) return;
    ctx.marker?.remove();
    ctx.marker = undefined;
    if (ctx.labelLayer) {
      const label = document.createElement("span");
      label.textContent = (
        ctx.labelLayer as Leaflet.Polygon & {
          feature: { properties: { name: string } };
        }
      ).feature.properties.name;
      ctx.labelLayer.unbindTooltip().bindTooltip(label, { sticky: true });
      ctx.labelLayer = undefined;
    }
    ctx.outlines?.eachLayer((layer) => {
      const path = layer as Leaflet.Polygon;
      const name = (
        path as Leaflet.Polygon & { feature: { properties: { name: string } } }
      ).feature.properties.name;
      path.setStyle(
        name === focusName || matchingNames.includes(name)
          ? selectedStyle
          : outlineStyle,
      );
      if (name === focusName) {
        path.bringToFront();
        if (!ctx.labelLayer) {
          const label = document.createElement("span");
          label.textContent = name;
          path
            .unbindTooltip()
            .bindTooltip(label, { permanent: true, direction: "center" })
            .openTooltip();
          ctx.labelLayer = path;
        }
      }
    });
    const county = countyNames.get(focusName);
    if (county && !outlineError) {
      const [south, west, north, east] = county.bounds;
      ctx.map.fitBounds(
        [
          [south, west],
          [north, east],
        ],
        { padding: [24, 24], maxZoom: 16, animate: false },
      );
      return;
    }
    const point = anchors[focusName];
    if (point) {
      ctx.marker = ctx.L.circleMarker(point, {
        radius: 12,
        color: "#fff",
        weight: 3,
        fillColor: "#172c45",
        fillOpacity: 1,
      }).addTo(ctx.map);
      const label = document.createElement("span");
      label.textContent = focusName;
      ctx.marker.bindTooltip(label, {
        permanent: true,
        direction: "top",
        offset: [0, -12],
      });
      ctx.map.setView(point, 15, { animate: false });
    } else if (!address)
      ctx.map.fitBounds(pickerMapBounds, { padding: [8, 8], animate: false });
  }, [focusName, ready, outlineError, matchingNames, address]);

  useEffect(() => {
    const ctx = live.current;
    if (!ctx || !ready) return;
    ctx.addressMarker?.remove();
    ctx.addressMarker = undefined;
    if (!address || !coveredByPickerMap(address)) return;
    const point: Leaflet.LatLngTuple = [address.lat, address.lng];
    ctx.addressMarker = ctx.L.circleMarker(point, {
      radius: 9,
      color: "#172c45",
      weight: 3,
      fillColor: "#fff",
      fillOpacity: 1,
    }).addTo(ctx.map);
    const label = document.createElement("span");
    label.textContent = address.label;
    ctx.addressMarker.bindTooltip(label, {
      permanent: true,
      direction: "top",
      offset: [0, -10],
    });
    ctx.map.setView(point, 15, { animate: false });
  }, [address, ready]);

  function changeMode(next: Mode) {
    const ctx = live.current;
    if (!ctx) return;
    setMode(next);
    setTileError(false);
    if (next === "streets" || next === "compare") ctx.streets.addTo(ctx.map);
    else ctx.streets.remove();
    if (next === "aerial" || next === "compare") {
      ctx.aerial.setOpacity(next === "compare" ? 0.6 : 1).addTo(ctx.map);
    } else ctx.aerial.remove();
    // County shapes stay on top of each optional background.
    ctx.outlines?.bringToFront();
    ctx.addressMarker?.bringToFront();
    ctx.marker?.bringToFront();
  }
  function reset() {
    setFocusName("");
    live.current?.map.fitBounds(pickerMapBounds, {
      padding: [8, 8],
      animate: false,
    });
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
          {searchableNames.map((name) => (
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
        {(["outlines", "streets", "aerial", "compare"] as const).map(
          (value) => (
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
          ),
        )}
      </div>
      <p id={helpId} className="text-sm text-muted-foreground">
        {copy.help}
      </p>
      {!ready && (
        <p role="status" className="text-sm">
          {copy.loading}
        </p>
      )}
      {outlineError && (
        <p role="alert" className="text-sm text-destructive">
          {copy.outlineError}
        </p>
      )}
      {aerialError && (
        <p role="alert" className="text-sm text-destructive">
          {copy.aerialError}
        </p>
      )}
      {tileError && (
        <p role="alert" className="text-sm text-destructive">
          {copy.streetError}
        </p>
      )}
      {mode === "streets" || mode === "compare" ? (
        <p className="text-sm text-muted-foreground">{copy.streetPrivacy}</p>
      ) : null}
      {address && outlines && (
        <div className="space-y-2 rounded border p-3">
          <p className="text-sm">
            {matchingNames.length ? copy.atMarker : copy.noOutlineAtMarker}
          </p>
          {!!matchingNames.length && (
            <div className="flex flex-wrap gap-2">
              {matchingNames.map((name) => (
                <Button
                  key={name}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setFocusName(name)}
                >
                  {name}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
      <div
        ref={container}
        role="region"
        aria-label={copy.region}
        aria-describedby={helpId}
        className="map-canvas h-[26rem] w-full rounded-md border sm:h-[32rem]"
      />
      {focusName && (
        <div className="space-y-2 rounded border p-3">
          <p role="status" className="text-sm">
            {t(
              countyNames.has(focusName) && !outlineError
                ? copy.countyLocated
                : anchors[focusName]
                  ? copy.located
                  : copy.missing,
              { name: focusName },
            )}
          </p>
          {countyNames.has(focusName) && (
            <p className="text-xs text-muted-foreground">
              {t(copy.platCount, {
                count: String(countyNames.get(focusName)!.sourceIds.length),
              })}
            </p>
          )}
          {names.includes(focusName) ? (
            <Button
              type="button"
              className="min-h-11"
              onClick={() => onChooseName(focusName)}
            >
              {t(copy.chooseFocused, { name: focusName })}
            </Button>
          ) : (
            <p className="text-sm">{copy.choiceUnavailable}</p>
          )}
        </div>
      )}
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
      <p className="text-xs text-muted-foreground">
        <a
          href={subdivisionCatalog.source}
          target="_blank"
          rel="noopener"
          className="underline"
        >
          {copy.countyCredit}
        </a>{" "}
        · {subdivisionCatalog.date}
        {mode === "aerial" || mode === "compare" ? (
          <> · {copy.aerialCredit}</>
        ) : null}
        {mode === "streets" || mode === "compare" ? (
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
        ) : null}
      </p>
      <p className="text-sm text-muted-foreground">{copy.selectionHint}</p>
    </div>
  );
}
