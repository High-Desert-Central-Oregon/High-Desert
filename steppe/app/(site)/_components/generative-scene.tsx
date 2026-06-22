"use client";

import "./generative-landscape.css";
import { GenerativeLandscape } from "./generative-landscape";
import { GenerativeReadout } from "./generative-readout";
import { WeatherCanvas, WeatherController, StarLayer } from "./hero-sky";
import { useHeroWeather } from "./use-hero-weather";
import { weatherToMood } from "@/lib/weather";

/**
 * The generative hero scene: the WebGL landscape base (GenerativeLandscape) with the
 * existing canvas + anime.js weather engine composited on top for the MOVING weather.
 *
 * Layering (back → front): shader canvas → drifting clouds → weather canvas
 * (wind/rain/snow/fog) → night shooting stars → readout chip (Part 4) → hero content.
 *
 * The shader owns the SCENE (sky/sun/moon/ridges/foreground/stars + mood response);
 * the engine owns the MOVING weather — so there's no double weather. Notably there is
 * NO SunOrb here: the shader already draws the sun/moon (no second sun). Clouds and
 * wind/rain/snow/fog are day-only and reduced-motion-safe (gated in hero-sky.tsx +
 * landing.css); the shooting stars show at night.
 *
 * Weather data: the shader mood comes from useHeroWeather (mapped via weatherToMood);
 * the engine reads the same cached /api/weather (WeatherController). Both hit only the
 * internal cached proxy — the browser never calls open-meteo.com — and a proxy failure
 * eases each into the same calm default, so they stay in agreement.
 */
export function GenerativeScene({
  seed = 427,
  readout = true,
}: {
  seed?: number;
  /** Show the time · weather · location chip. Set false to disable it. */
  readout?: boolean;
}) {
  const weather = useHeroWeather();
  const mood = weather
    ? weatherToMood(weather)
    : { cloudCover: 0, overcast: 0, wet: 0, snow: 0 };

  return (
    <div className="gl-scene">
      <GenerativeLandscape
        seed={seed}
        cloudCover={mood.cloudCover}
        overcast={mood.overcast}
        wet={mood.wet}
        snow={mood.snow}
      />
      <div className="gl-weather" aria-hidden="true">
        {/* Drifting clouds (anime.js) — the engine's own readout is off; we use the
            generative chip below instead. */}
        <WeatherController readout={false} />
        {/* Wind / rain / snow / fog (day-only, reduced-motion → still frame). */}
        <WeatherCanvas className="band-wind" />
        {/* Night shooting stars (kept; off under reduced motion). */}
        <StarLayer className="band-stars" count={16} meteor meteorMin={1800} meteorMax={5200} />
      </div>
      {readout && <GenerativeReadout weather={weather} />}
    </div>
  );
}
