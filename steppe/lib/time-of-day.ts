// Shared day/night + time-of-day decision, anchored to Redmond's real local time
// (America/Los_Angeles). Pure + dependency-free so it can be consumed server-side (the
// /api/weather proxy) and mirrored by the no-flash inline script in the root layout.
//
// The theme flips to dark only at night; dawn/day/dusk render light (the landscape sky
// still moves through all four via data-time). Boundaries are fixed local hours — a
// good approximation; the proxy's is_day/sunrise/sunset (see lib/weather isDaytime) can
// refine the exact flip if needed.

export type TimeOfDay = "dawn" | "day" | "dusk" | "night";

/** Current hour (0–23) in Redmond's timezone, from any Date. */
export function redmondHour(now: Date): number {
  const h = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  return Number.isFinite(h) ? h % 24 : 12;
}

export function timeOfDayForHour(h: number): TimeOfDay {
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 8 && h < 18) return "day";
  if (h >= 18 && h < 21) return "dusk";
  return "night";
}

export function redmondTimeOfDay(now: Date): { time: TimeOfDay; theme: "light" | "dark" } {
  const time = timeOfDayForHour(redmondHour(now));
  return { time, theme: time === "night" ? "dark" : "light" };
}
