"use client";

import { useEffect, useState } from "react";
import { redmondHour, timeOfDayForHour } from "@/lib/time-of-day";

/**
 * Marketing theme + time-of-day controller.
 *
 * POLICY (2026-07-11): the marketing layer is AUTOMATIC by Redmond's clock —
 * data-time tracks the local time of day and the theme follows it (night →
 * dark, otherwise light; lib/time-of-day.ts is the one source of the mapping
 * and the hour boundaries). A member's explicit sun/moon choice overrides the
 * clock: it persists to localStorage("steppe-theme") and wins until they cycle
 * back to automatic. The no-flash inline script in app/layout.tsx applies the
 * same rule before first paint; this component keeps it live:
 *   - re-evaluates on a timer and when the tab returns, so a session left open
 *     across sunset switches sky AND theme (in auto) on its own,
 *   - the toggle cycles Auto → Light → Dark → Auto ("auto" = no stored value).
 *
 * The member app (/protected, /auth) is untouched by all of this: it themes
 * via next-themes' class, forced light in app/layout.tsx, and no member
 * surface reads data-time or data-theme.
 *
 * The sun/moon icon swap is pure CSS keyed on html[data-theme].
 */
type Mode = "auto" | "light" | "dark";
const STORAGE_KEY = "steppe-theme";
const REEVAL_MS = 5 * 60_000;

function readMode(): Mode {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === "light" || s === "dark") return s;
  } catch {
    // ignore storage access errors (private mode, etc.)
  }
  return "auto";
}

// data-time always follows Redmond's clock (sky ambience); data-theme follows
// it too unless the member stored an explicit choice.
function apply(mode: Mode) {
  const root = document.documentElement;
  const time = timeOfDayForHour(redmondHour(new Date()));
  root.setAttribute("data-time", time);
  root.setAttribute(
    "data-theme",
    mode === "auto" ? (time === "night" ? "dark" : "light") : mode,
  );
}

export function ThemeController() {
  const [mode, setMode] = useState<Mode>("auto");

  useEffect(() => {
    const m = readMode();
    setMode(m);
    apply(m);

    // Re-evaluate periodically and when the tab regains focus, so an open
    // session tracks sunrise/sunset on its own (theme only moves in auto).
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
