"use client";

import { useId, useState } from "react";
import { Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n";
import type { NeighborhoodMapView } from "./neighborhood-map-view";

/** Static, native disclosure first. The library and detailed raster load on request. */
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
    <details className="group rounded-lg border bg-card">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-lg px-4 py-3 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
        <MapIcon size={18} aria-hidden="true" />
        <span id={titleId}>{copy.title}</span>
        <span
          className="ml-auto text-sm text-muted-foreground group-open:rotate-45"
          aria-hidden="true"
        >
          ＋
        </span>
      </summary>
      <section aria-labelledby={titleId} className="space-y-3 border-t p-4">
        <p className="text-sm text-muted-foreground">{copy.intro}</p>
        <p className="text-sm font-medium">{copy.date}</p>
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
    </details>
  );
}
