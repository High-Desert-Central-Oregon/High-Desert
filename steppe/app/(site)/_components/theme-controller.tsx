"use client";

import { useEffect, useState } from "react";

/**
 * Marketing theme + time-of-day controller.
 *
 * The no-flash inline script in app/layout.tsx already set data-time, data-theme
 * and data-js on <html> before paint, using the same rule as here. This client
 * component keeps it live and exposes the toggle:
 *   - data-time tracks the local clock; data-theme follows it automatically
 *     (night → dark, otherwise → light) so the theme moves with the strata,
 *   - re-evaluates on a timer and when the tab returns (visibilitychange/focus),
 *     so a session left open across sunset switches itself,
 *   - the toggle is a manual override cycling Auto → Light → Dark → Auto; a manual
 *     choice persists to localStorage("steppe-theme") and stops auto-switching;
 *     "Auto" (the default, no stored value) resumes following time.
 *
 * The sun/moon icon swap is pure CSS keyed on html[data-theme].
 */
type Mode = "auto" | "light" | "dark";
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
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === "light" || s === "dark") return s;
  } catch {
    // ignore storage access errors (private mode, etc.)
  }
  return "auto";
}

// Apply data-time (always by clock) and data-theme (manual override, else by time).
function apply(mode: Mode) {
  const root = document.documentElement;
  const t = timeOfDay(new Date().getHours());
  root.setAttribute("data-time", t);
  root.setAttribute(
    "data-theme",
    mode === "auto" ? (t === "night" ? "dark" : "light") : mode,
  );
}

export function ThemeController() {
  const [mode, setMode] = useState<Mode>("auto");

  useEffect(() => {
    const m = readMode();
    setMode(m);
    apply(m);

    // Re-evaluate periodically and when the tab regains focus, so an open session
    // tracks sunrise/sunset on its own (only changes theme while in auto mode).
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
    const next: Mode =
      mode === "auto" ? "light" : mode === "light" ? "dark" : "auto";
    setMode(next);
    try {
      if (next === "auto") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // persistence is best-effort
    }
    apply(next);
  }

  const label =
    mode === "auto"
      ? "Theme: automatic by time of day. Activate to set light."
      : mode === "light"
        ? "Theme: light. Activate to set dark."
        : "Theme: dark. Activate to return to automatic.";

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
