"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { type AddressPoint } from "@/lib/neighborhood-address";
import {
  coveredByPickerMap,
  subdivisionCatalog,
} from "@/lib/subdivision-outlines";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n";
import type { NeighborhoodMapView } from "./neighborhood-map-view";

/** Map opens with a static county overview; detailed outlines load on request. */
export function NeighborhoodMap({
  dict,
  names,
  selectedName,
  onChooseName,
}: {
  dict: Dictionary;
  names: string[];
  selectedName?: string;
  onChooseName: (name: string) => void;
}) {
  const copy = dict.neighborhoods.map;
  const titleId = useId();
  const addressId = useId();
  const privacyId = useId();
  const resultsId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddressPoint[]>([]);
  const [address, setAddress] = useState<AddressPoint | undefined>();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [composing, setComposing] = useState(false);
  const [searchState, setSearchState] = useState<
    "idle" | "loading" | "done" | "failed"
  >("idle");
  const request = useRef<AbortController | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const search = useCallback(
    async (value: string) => {
      clearTimeout(debounce.current);
      if (value.trim().length < 3) return;
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setSearchState("loading");
      setResults([]);
      setActive(-1);
      setOpen(true);
      try {
        const response = await fetch("/api/neighborhood-address", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: value.trim(), locale: copy.searchLocale }),
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
    },
    [copy.searchLocale],
  );

  useEffect(() => {
    if (composing || query.trim().length < 3 || query === address?.label)
      return;
    // Wait for a pause in typing; cancel both the timer and any stale response.
    debounce.current = setTimeout(() => void search(query), 650);
    return () => {
      clearTimeout(debounce.current);
      request.current?.abort();
    };
  }, [query, address?.label, composing, search]);
  useEffect(
    () => () => {
      clearTimeout(debounce.current);
      request.current?.abort();
    },
    [],
  );

  function chooseAddress(result: AddressPoint) {
    clearTimeout(debounce.current);
    request.current?.abort();
    setQuery(result.label);
    setAddress(result);
    setOpen(false);
    setActive(-1);
    if (!View && coveredByPickerMap(result)) void explore();
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
      <p className="text-sm font-medium">
        {copy.countyDate.replace("{date}", subdivisionCatalog.date)}
      </p>
      <div
        className="space-y-2"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setOpen(false);
            setActive(-1);
          }
        }}
      >
        <label htmlFor={addressId} className="text-sm font-medium">
          {copy.addressLabel}
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id={addressId}
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open && results.length > 0}
            aria-controls={resultsId}
            aria-activedescendant={
              open && active >= 0 ? `${resultsId}-${active}` : undefined
            }
            autoComplete="off"
            maxLength={200}
            value={query}
            aria-describedby={privacyId}
            placeholder={copy.addressPlaceholder}
            onFocus={() => setOpen(true)}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            onChange={(event) => {
              clearTimeout(debounce.current);
              request.current?.abort();
              setQuery(event.target.value);
              setResults([]);
              setAddress(undefined);
              setSearchState("idle");
              setActive(-1);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Escape") {
                event.preventDefault();
                clearTimeout(debounce.current);
                request.current?.abort();
                setSearchState("idle");
                setOpen(false);
                setActive(-1);
              }
              if (
                open &&
                results.length &&
                ["ArrowDown", "ArrowUp"].includes(event.key)
              ) {
                event.preventDefault();
                setActive((previous) =>
                  previous < 0
                    ? event.key === "ArrowDown"
                      ? 0
                      : results.length - 1
                    : (previous +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        results.length) %
                      results.length,
                );
              }
              if (event.key === "Enter") {
                event.preventDefault();
                if (open && active >= 0 && results[active])
                  chooseAddress(results[active]);
                else void search(query);
              }
            }}
            className="min-h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          />
          <Button
            type="button"
            className="min-h-11"
            disabled={query.trim().length < 3 || searchState === "loading"}
            onClick={() => void search(query)}
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
        {open && searchState === "done" && (
          <p role="status" className="text-sm">
            {results.length ? copy.pickAddress : copy.noAddress}
          </p>
        )}
        {open && !!results.length && (
          <ul
            id={resultsId}
            role="listbox"
            aria-label={copy.addressLabel}
            className="space-y-1"
          >
            {results.map((result, index) => (
              <li key={index} role="none">
                <button
                  type="button"
                  id={`${resultsId}-${index}`}
                  role="option"
                  className={`min-h-11 w-full rounded border px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${active === index ? "bg-muted" : ""}`}
                  aria-selected={active === index}
                  onClick={() => chooseAddress(result)}
                >
                  {result.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!!results.length && (
          <p className="text-xs text-muted-foreground">
            {results.some((result) => result.source === "county") ? (
              <a
                href="https://maps.deschutes.org/server/rest/services/Hosted/E911_Address_Points/FeatureServer"
                target="_blank"
                rel="noopener"
                className="underline"
              >
                Deschutes County — E911
              </a>
            ) : (
              <>
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
              </>
            )}
          </p>
        )}
        {address && (
          <p role="status" className="text-sm">
            {coveredByPickerMap(address)
              ? copy.addressLocated
              : copy.addressOutside}
          </p>
        )}
        <p className="text-sm text-muted-foreground">{copy.addressHint}</p>
        {!!query.length && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={() => {
              clearTimeout(debounce.current);
              request.current?.abort();
              setQuery("");
              setResults([]);
              setAddress(undefined);
              setSearchState("idle");
              setOpen(false);
              setActive(-1);
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
            onChooseName={onChooseName}
            address={address}
            onError={() => {
              setFailed(true);
              setView(null);
            }}
          />
        </>
      ) : (
        <>
          {/* Static county outlines remain usable without loading the interactive map. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/maps/redmond-current/overview.svg"
            alt={copy.countyAlt}
            width={720}
            height={860}
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
