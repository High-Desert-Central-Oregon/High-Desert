"use client";

import { useEffect, useState } from "react";

/**
 * Marketing theme + time-of-day controller.
 *
 * POLICY (2026-07-11): light is the default, always — dark is OPT-IN ONLY.
 * Nothing automatic flips the theme: not OS preference, not the clock. The
 * no-flash inline script in app/layout.tsx already applied the stored choice
 * (localStorage "steppe-theme") before paint; this component keeps it live:
 *   - data-time still tracks the local clock (dawn/day/dusk/night) — that is
 *     AMBIENCE ONLY (the hero sky/sun); it never touches data-theme,
 *   - the toggle flips Light ↔ Dark and persists the explicit choice,
 *   - re-evaluates on a timer and when the tab returns, so the SKY tracks
 *     sunset while the theme stays exactly what the member chose.
 *
 * The sun/moon icon swap is pure CSS keyed on html[data-theme].
 */
type Mode = "light" | "dark";
type Time = "dawn" | "day" | "dusk" | "night";
const STORAGE_KEY = "steppe-theme";
const REEVAL_MS = 5 * 60_000;

function timeOfDay(hour: number): Time {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

function readMode(): Mode {
  try {
    if (localStorage.getItem(STORAGE_KEY) === "dark") return "dark";
  } catch {
    // ignore storage access errors (private mode, etc.)
  }
  return "light";
}

// data-time follows the clock (sky ambience); data-theme is the member's choice.
function apply(mode: Mode) {
  const root = document.documentElement;
  root.setAttribute("data-time", timeOfDay(new Date().getHours()));
  root.setAttribute("data-theme", mode);
}

export function ThemeController() {
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    const m = readMode();
    setMode(m);
    apply(m);

    // Keep the SKY tracking sunrise/sunset in an open session; the theme is
    // re-applied from the stored choice and never changes on its own.
    const tick = () => apply(readMode());
    const id = window.setInterval(tick, REEVAL_MS);
    const onVis = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", tick);
    };
  }, []);

  function cycle() {
    const next: Mode = mode === "light" ? "dark" : "light";
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // persistence is best-effort
    }
    apply(next);
  }

  const label =
    mode === "light"
      ? "Theme: light (default). Activate to switch to dark."
      : "Theme: dark. Activate to switch to light.";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cycle}
      aria-label={label}
      title={label}
      data-mode={mode}
    >
      <svg
        className="sun"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
      <svg
        className="moon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
