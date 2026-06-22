// Shared weather helpers for the hero (client + server safe, no React).
//
// The shape mirrors the /api/weather proxy response (a cached, server-side
// Open-Meteo read for Redmond — the browser never calls a third party). The
// weather-code tables mirror hero-sky.tsx's classic engine so the generative
// scene and the classic scene classify conditions identically.

export type Weather = {
  temperature_2m: number;
  weather_code: number;
  cloud_cover?: number;
  wind_speed_10m: number;
  wind_gusts_10m?: number;
  wind_direction_10m: number;
  fallback?: boolean;
};

export type Mode = "wind" | "rain" | "snow" | "fog";

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export function modeFor(code: number): Mode {
  if ([45, 48].includes(code)) return "fog";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code))
    return "rain";
  return "wind";
}

export function intensityFor(code: number): number {
  if ([55, 65, 67, 75, 82, 86, 95, 96, 99, 77].includes(code)) return 1;
  if ([53, 63, 73, 81, 85, 56, 66].includes(code)) return 0.7;
  return 0.45;
}

export function codeLabel(code: number): string {
  if (code === 0) return "clear";
  if (code <= 2) return "mostly clear";
  if (code === 3) return "overcast";
  if (code <= 48) return "fog";
  if (code <= 57) return "drizzle";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "showers";
  if (code <= 86) return "snow showers";
  return "thunderstorm";
}

export function compass(deg: number): string {
  return ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][
    Math.round(deg / 22.5) % 16
  ];
}

export type Mood = { cloudCover: number; overcast: number; wet: number; snow: number };

/**
 * Map live conditions to the generative shader's mood uniforms (0..1):
 *   cloud_cover % → cloudCover (+ overcast once skies are mostly covered),
 *   precip codes  → wet (foreground wets/darkens),
 *   snow codes    → snow (ground whitens).
 * Fog is the library layer's job (Vanta in the spec; the canvas fog here), so a
 * foggy sky only reads as light overcast in the shader — never a shader fog veil.
 */
export function weatherToMood(w: Weather): Mood {
  const cc = clamp((w.cloud_cover ?? 30) / 100, 0, 1);
  const mode = modeFor(w.weather_code);
  const intensity = intensityFor(w.weather_code);
  const overcast = clamp(
    Math.max(
      w.weather_code === 3 ? 0.85 : 0,
      (cc - 0.5) / 0.5,
      mode === "fog" ? 0.45 : 0,
      mode === "rain" ? 0.7 : 0,
      mode === "snow" ? 0.5 : 0,
    ),
    0,
    1,
  );
  const wet = mode === "rain" ? clamp(0.45 + intensity * 0.45, 0, 1) : 0;
  const snow = mode === "snow" ? clamp(0.5 + intensity * 0.45, 0, 1) : 0;
  return { cloudCover: cc, overcast, wet, snow };
}
