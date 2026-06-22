"use client";

import { GenerativeLandscape } from "./generative-landscape";
import { useHeroWeather } from "./use-hero-weather";
import { weatherToMood } from "@/lib/weather";

/**
 * The generative hero scene: the WebGL landscape base (GenerativeLandscape) driven by
 * live Redmond weather, with the moving-weather library layer composited on top.
 *
 * One data source: useHeroWeather polls the cached /api/weather and we map it to the
 * shader's mood uniforms (cloud_cover → cloudCover/overcast, precip → wet, snow →
 * snow). The shader eases toward the new values internally, so refreshes glide in
 * rather than snapping. The library weather motion (wind/rain/snow/fog/clouds +
 * shooting stars) and the readout chip are layered in subsequent parts.
 */
export function GenerativeScene({ seed = 427 }: { seed?: number }) {
  const weather = useHeroWeather();
  const mood = weather
    ? weatherToMood(weather)
    : { cloudCover: 0, overcast: 0, wet: 0, snow: 0 };

  return (
    <GenerativeLandscape
      seed={seed}
      cloudCover={mood.cloudCover}
      overcast={mood.overcast}
      wet={mood.wet}
      snow={mood.snow}
    />
  );
}
