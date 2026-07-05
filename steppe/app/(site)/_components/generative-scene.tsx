"use client";

import { useState } from "react";
import "./generative-landscape.css";
import { GenerativeLandscape } from "./generative-landscape";
import { GenerativeReadout } from "./generative-readout";
import { WeatherLayer } from "./weather-layer";
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
 * wind/rain/snow/fog are day-only and reduced-motion-safe (gated in hero-sky.tsx);
 * the shooting stars show at night.
 *
 * Weather data: the shader mood comes from useHeroWeather (mapped via weatherToMood);
 * the engine reads the same cached /api/weather (WeatherController). Both hit only the
 * internal cached proxy — the browser never calls open-meteo.com — and a proxy failure
 * eases each into the same calm default, so they stay in agreement.
 *
 * "A canvas for users": the scene is a full-band button — tap / click / Enter
 * regenerates the generative seed (a fresh ridgeline "plate"), which the shader morphs
 * to. Time, weather and the moon stay locked to live Redmond reality (only the plate is
 * user-driven, per the product note). Touch-first, so it works on mobile.
 */
export function GenerativeScene({
  seed = 427,
  readout = true,
  creditTagline,
}: {
  seed?: number;
  /** Show the time · weather · location chip. Set false to disable it. */
  readout?: boolean;
  /** When set, render the masthead credit "Masthead NNN · {tagline}", NNN being the
   *  plate counter that increments on each New Plate. */
  creditTagline?: string;
}) {
  const weather = useHeroWeather();
  const mood = weather
    ? weatherToMood(weather)
    : { cloudCover: 0, overcast: 0, wet: 0, snow: 0 };
  const [plate, setPlate] = useState(seed);
  const [count, setCount] = useState(1);

  // New Plate: a fresh seed (a visibly new ridgeline composition the shader morphs to)
  // and a bumped plate counter. The seed fully determines the plate (deterministic).
  const regenerate = () => {
    setPlate((s) => {
      let n = s;
      while (n === s) n = Math.floor(Math.random() * 1000);
      return n;
    });
    setCount((c) => c + 1);
  };

  return (
    <div className="gl-scene">
      <GenerativeLandscape
        seed={plate}
        cloudCover={mood.cloudCover}
        overcast={mood.overcast}
        wet={mood.wet}
        snow={mood.snow}
      />
      {/* Library weather hybrid (tsParticles wind/rain/snow/haze + GSAP clouds + lazy
          Vanta fog), locked to live Redmond conditions; full-bleed, no wind cutoff. */}
      <WeatherLayer weather={weather} />
      {readout && <GenerativeReadout weather={weather} />}
      {/* New Plate — a discrete chip button (only this regenerates; tapping the
          landscape itself does nothing). Touch-first and keyboard-accessible. */}
      <button
        type="button"
        className="gl-newplate"
        onClick={regenerate}
        aria-label={`Generate a new landscape plate (currently plate ${count})`}
      >
        ↻ New plate
      </button>
      {/* Strata labels — revealed on hover (desktop pointers only); decorative. */}
      <div className="gl-strata" aria-hidden="true">
        <span className="gl-strata-label" style={{ top: "38%" }}>
          Rimrock
        </span>
        <span className="gl-strata-label" style={{ top: "54%" }}>
          Juniper bench
        </span>
        <span className="gl-strata-label" style={{ top: "70%" }}>
          Canyon floor
        </span>
      </div>
      {creditTagline && (
        <span className="gl-credit" aria-live="polite">
          Masthead {String(count).padStart(3, "0")} · {creditTagline}
        </span>
      )}
    </div>
  );
}
