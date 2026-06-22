import { NextResponse } from "next/server";

/**
 * Public weather proxy for the landing hero (Central Oregon / Redmond).
 *
 * Fetches current conditions from Open-Meteo (keyless) SERVER-SIDE and caches the
 * result, so the visitor's browser never contacts a third party. No user data
 * (not even an IP) is sent to Open-Meteo, so this adds no user-data subprocessor —
 * it's a cached public-data proxy. The hero client polls this endpoint (~10 min).
 *
 * No `export const runtime` — pinning a runtime is incompatible with
 * cacheComponents (next.config) and broke the build once. Caching is done with
 * fetch revalidation (~10 min), so only Steppe's server hits Open-Meteo.
 */

const LAT = 44.2726;
const LON = -121.1739;
const OPEN_METEO =
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
  `&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day` +
  `&daily=sunrise,sunset&forecast_days=1` +
  `&wind_speed_unit=mph&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles`;

// Calm default if Open-Meteo is unreachable — a gentle high-desert breeze.
// is_day/sunrise/sunset are null so the day/night util falls back to a local-hour rule.
const FALLBACK = {
  temperature_2m: 62,
  weather_code: 1,
  cloud_cover: 25,
  wind_speed_10m: 7,
  wind_gusts_10m: 12,
  wind_direction_10m: 295,
  is_day: null,
  sunrise: null,
  sunset: null,
  fallback: true,
};

export async function GET() {
  try {
    // Cached upstream call: revalidated ~every 10 minutes, shared across all
    // visitors, so Open-Meteo sees only Steppe's server, not member traffic.
    const r = await fetch(OPEN_METEO, { next: { revalidate: 600 } });
    if (!r.ok) throw new Error(`open-meteo ${r.status}`);
    const j = await r.json();
    const c = j.current ?? {};
    const d = j.daily ?? {};
    const out = {
      temperature_2m: c.temperature_2m,
      weather_code: c.weather_code,
      cloud_cover: c.cloud_cover,
      wind_speed_10m: c.wind_speed_10m,
      wind_gusts_10m: c.wind_gusts_10m,
      wind_direction_10m: c.wind_direction_10m,
      // is_day (1/0) + today's sunrise/sunset (local ISO) drive the time-of-day theme.
      is_day: c.is_day,
      sunrise: Array.isArray(d.sunrise) ? d.sunrise[0] : null,
      sunset: Array.isArray(d.sunset) ? d.sunset[0] : null,
    };
    return NextResponse.json(out, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=1800",
      },
    });
  } catch {
    // Never error visibly to the hero — hand back the calm default.
    return NextResponse.json(FALLBACK, { headers: { "Cache-Control": "no-store" } });
  }
}
