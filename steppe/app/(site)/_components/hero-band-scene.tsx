"use client";

import { useEffect, useState } from "react";
import { StrataHorizon } from "./strata-horizon";
import { WeatherCanvas, WeatherController, StarLayer, SunOrb } from "./hero-sky";
import { GenerativeScene } from "./generative-scene";

/**
 * The landing hero's landscape band, in one of two selectable sceneries:
 *
 *   "classic"     — the approved live-weather band: drifting clouds + the 4-mode
 *                   weather canvas (wind/rain/snow/fog) + night stars/meteors + a
 *                   round sun/moon orb over the strata SVG (sky + hills).
 *   "generative"  — the WebGL generative landscape as the BASE scene, with that same
 *                   canvas+anime weather engine layered on top for the motion
 *                   (GenerativeScene). The shader draws the sun + the real phased moon.
 *
 * The default comes from the server (HERO_SCENE env, default "classic"); a non-prod
 * dev hook (?scene=generative|classic) can override it. The initial client render
 * matches the server default to avoid a hydration mismatch; any ?scene override is
 * applied after mount. Both sceneries fall back to a still frame under reduced motion
 * and to a static image with no WebGL (the generative shader's own fallback).
 */
export type Scene = "classic" | "generative";

export function HeroBandScene({ defaultScene = "classic" }: { defaultScene?: Scene }) {
  const [scene, setScene] = useState<Scene>(defaultScene);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return; // dev hook only
    const q = new URLSearchParams(window.location.search).get("scene");
    if (q === "generative" || q === "classic") setScene(q);
  }, []);

  if (scene === "generative") return <GenerativeScene />;

  return (
    <div className="hero-band">
      {/* Live weather band: clouds + readout + sun/sky softening (controller),
          the 4-mode weather canvas (wind/rain/snow/fog), night stars/meteors,
          and a round sun/moon overlay above the weather so particles pass behind
          it. The strata SVG provides only the sky gradient + hills. */}
      <WeatherController />
      <WeatherCanvas className="band-wind" />
      <StarLayer className="band-stars" count={16} meteor meteorMin={1800} meteorMax={5200} />
      <SunOrb />
      <StrataHorizon variant="hero" />
    </div>
  );
}
