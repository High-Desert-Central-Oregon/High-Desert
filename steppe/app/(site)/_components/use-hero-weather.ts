"use client";

import { useEffect, useState } from "react";
import type { Weather } from "@/lib/weather";

/**
 * Single source of live weather for the generative hero scene: polls the existing
 * cached /api/weather proxy (~10 min) — never open-meteo.com directly — and hands
 * back the latest reading. One hook feeds BOTH the shader mood and the library
 * weather layer, so there's one poll, one data source, no double fetch.
 *
 * Fails soft: if the proxy is unreachable it eases into a calm high-desert default
 * (≈7 mph WSW, light cloud) rather than erroring. Re-fetches when the tab returns.
 */

const REFRESH_MS = 10 * 60 * 1000;

// Matches the /api/weather FALLBACK — a gentle Redmond breeze.
const CALM: Weather = {
  temperature_2m: 62,
  weather_code: 1,
  cloud_cover: 25,
  wind_speed_10m: 7,
  wind_gusts_10m: 12,
  wind_direction_10m: 295,
  fallback: true,
};

export function useHeroWeather(): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchWeather = async () => {
      try {
        const res = await fetch("/api/weather", { cache: "no-store" });
        if (!res.ok) throw new Error("weather " + res.status);
        const w = (await res.json()) as Weather;
        if (!cancelled) setWeather(w);
      } catch {
        if (!cancelled) setWeather(CALM); // calm default — never error visibly
      }
    };

    fetchWeather();
    const poll = window.setInterval(fetchWeather, REFRESH_MS);
    const onVis = () => {
      if (!document.hidden) fetchWeather();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return weather;
}
