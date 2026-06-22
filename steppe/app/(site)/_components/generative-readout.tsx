"use client";

import { useEffect, useRef } from "react";
import { animate } from "animejs";
import { codeLabel, compass, type Weather } from "@/lib/weather";

/**
 * The generative scene's time · weather · location readout — a small, understated
 * chip so visitors understand what they're seeing:
 *
 *   REDMOND · {condition} · {wind dir + mph} · {temp}°
 *
 * It fades in once (anime.js; a still chip under prefers-reduced-motion) and then
 * updates its text in place on each weather refresh. Colours are theme-aware (CSS),
 * so it reflects the current data-time and stays legible at every breakpoint. Easy to
 * disable: the scene simply doesn't render it (the `readout` flag on GenerativeScene).
 */
export function GenerativeReadout({ weather }: { weather: Weather | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const shown = useRef(false);

  useEffect(() => {
    if (!weather || shown.current) return;
    const el = ref.current;
    if (!el) return;
    shown.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.opacity = "1";
      return;
    }
    animate(el, { opacity: [0, 1], translateY: [6, 0], duration: 900, ease: "outCubic" });
  }, [weather]);

  const text = weather
    ? `REDMOND · ${codeLabel(weather.weather_code)} · ${compass(weather.wind_direction_10m)} ${Math.round(
        weather.wind_speed_10m,
      )} mph · ${Math.round(weather.temperature_2m)}°`
    : "";

  return (
    <div ref={ref} className="gl-readout" style={{ opacity: 0 }} role="status">
      <span className="gl-live" aria-hidden="true" />
      {text}
    </div>
  );
}
