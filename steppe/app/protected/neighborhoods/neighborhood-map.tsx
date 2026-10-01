"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  coveredByNeighborhoodMap,
  type AddressPoint,
} from "@/lib/neighborhood-address";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n";
import type { NeighborhoodMapView } from "./neighborhood-map-view";

/** Map is visible first with a lightweight overview. The library and detailed raster load on request. */
export function NeighborhoodMap({
  dict,
  names,
  selectedName,
}: {
  dict: Dictionary;
  names: string[];
  selectedName?: string;
}) {
  const copy = dict.neighborhoods.map;
  const titleId = useId();
  const addressId = useId();
  const privacyId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddressPoint[]>([]);
  const [address, setAddress] = useState<AddressPoint | undefined>();
  const [searchState, setSearchState] = useState<
    "idle" | "loading" | "done" | "failed"
  >("idle");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function search() {
    if (query.trim().length < 3) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setSearchState("loading");
    setResults([]);
    setAddress(undefined);
    try {
      const response = await fetch("/api/neighborhood-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: query.trim(), locale: copy.searchLocale }),
        signal: controller.signal,
        cache: "no-store",
      });
      const body = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok || body.unavailable)
        throw new Error("Address search unavailable");
      setResults(body.results);
      setSearchState("done");
    } catch {
      if (!controller.signal.aborted) setSearchState("failed");
    }
  }
  const [View, setView] = useState<typeof NeighborhoodMapView | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function explore() {
    setLoading(true);
    setFailed(false);
    try {
      const mapView = await import("./neighborhood-map-view");
      setView(() => mapView.NeighborhoodMapView);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      aria-labelledby={titleId}
      className="space-y-3 rounded-lg border bg-card p-4"
    >
      <h2 id={titleId} className="font-medium">
        {copy.title}
      </h2>
      <p className="text-sm text-muted-foreground">{copy.intro}</p>
      <p className="text-sm font-medium">{copy.date}</p>
      <div className="space-y-2">
        <label htmlFor={addressId} className="text-sm font-medium">
          {copy.addressLabel}
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id={addressId}
            type="search"
            autoComplete="off"
            maxLength={200}
            value={query}
            aria-describedby={privacyId}
            placeholder={copy.addressPlaceholder}
            onChange={(event) => {
              request.current?.abort();
              setQuery(event.target.value);
              setResults([]);
              setAddress(undefined);
              setSearchState("idle");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void search();
              }
            }}
            className="min-h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          />
          <Button
            type="button"
            className="min-h-11"
            disabled={query.trim().length < 3 || searchState === "loading"}
            onClick={() => void search()}
          >
            {searchState === "loading" ? copy.searching : copy.searchAddress}
          </Button>
        </div>
        <p id={privacyId} className="text-xs text-muted-foreground">
          {copy.addressPrivacy}
        </p>
        {searchState === "failed" && (
          <p role="alert" className="text-sm text-destructive">
            {copy.addressError}
          </p>
        )}
        {searchState === "done" && (
          <p role="status" className="text-sm">
            {results.length ? copy.pickAddress : copy.noAddress}
          </p>
        )}
        {!!results.length && (
          <ul className="space-y-1">
            {results.map((result, index) => (
              <li key={index}>
                <button
                  type="button"
                  className="min-h-11 w-full rounded border px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  aria-pressed={address === result}
                  onClick={() => {
                    setAddress(result);
                    if (!View && coveredByNeighborhoodMap(result))
                      void explore();
                  }}
                >
                  {result.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!!results.length && (
          <p className="text-xs text-muted-foreground">
            ©{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener"
              className="underline"
            >
              OpenStreetMap
            </a>{" "}
            {copy.contributors}
          </p>
        )}
        {address && (
          <p role="status" className="text-sm">
            {coveredByNeighborhoodMap(address)
              ? copy.addressLocated
              : copy.addressOutside}
          </p>
        )}
        <p className="text-sm text-muted-foreground">{copy.addressHint}</p>
        {searchState !== "idle" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={() => {
              request.current?.abort();
              setQuery("");
              setResults([]);
              setAddress(undefined);
              setSearchState("idle");
            }}
          >
            {copy.clearAddress}
          </Button>
        )}
      </div>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {copy.error}
        </p>
      )}
      {View ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={() => setView(null)}
          >
            {copy.overview}
          </Button>
          <View
            copy={copy}
            names={names}
            selectedName={selectedName}
            address={address}
            onError={() => {
              setFailed(true);
              setView(null);
            }}
          />
        </>
      ) : (
        <>
          {/* The source labels are raster text; the form below is the accessible chooser. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/maps/redmond-2019/overview.webp"
            alt={copy.alt}
            width={720}
            height={932}
            loading="lazy"
            className="mx-auto max-h-96 w-full rounded border object-contain bg-muted"
          />
          <Button
            className="min-h-11"
            type="button"
            disabled={loading}
            onClick={explore}
          >
            {loading ? copy.loading : copy.explore}
          </Button>
        </>
      )}
      <p className="text-sm text-muted-foreground">{copy.coverage}</p>
      <a
        href="/maps/redmond-2019/source.pdf"
        target="_blank"
        rel="noopener"
        className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
      >
        {copy.original}
      </a>
      <details className="text-sm text-muted-foreground">
        <summary className="min-h-11 cursor-pointer py-3">
          {copy.credits}
        </summary>
        <p className="mt-2">{copy.source}</p>
        <p className="mt-2">
          Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS,
          USDA, USGS, AeroGRID, IGN, GIS User Community.
        </p>
      </details>
    </section>
  );
}
