"use client";

import { useEffect, useState } from "react";

/**
 * Marketing theme + time-of-day controller.
 *
 * The no-flash inline script in app/layout.tsx has already set data-theme,
 * data-time and data-js on <html> synchronously before paint, reading the same
 * priority order used here (saved choice → OS prefers-color-scheme → night-is-
 * dark). This client component:
 *   - re-asserts data-time on mount (covers a statically-cached page loaded at a
 *     different hour),
 *   - exposes the manual light/dark toggle, persisting the choice to
 *     localStorage("steppe-theme") so it survives reloads,
 *   - follows OS theme changes only while the member hasn't made a manual choice.
 *
 * Renders the design's sun/moon toggle button; the sun/moon swap is handled in
 * CSS via html[data-theme="dark"].
 */
const STORAGE_KEY = "steppe-theme";

function timeOfDay(hour: number): "dawn" | "day" | "dusk" | "night" {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

export function ThemeController() {
  // Tracked only to re-render the button's aria-pressed; the source of truth is
  // the data-theme attribute on <html>.
  const [theme, setThemeState] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;

    // Keep the sky honest if this page was statically generated/cached earlier.
    root.setAttribute("data-time", timeOfDay(new Date().getHours()));
    setThemeState(root.getAttribute("data-theme") === "dark" ? "dark" : "light");

    // Follow the OS only until the member makes (and persists) a manual choice.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onOSChange = (e: MediaQueryListEvent) => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(STORAGE_KEY);
      } catch {
        // ignore storage access errors (private mode, etc.)
      }
      if (saved === "light" || saved === "dark") return;
      // Mirror the no-flash script's rule so OS-follow matches initial paint and
      // a reload: night is dark even if the OS flips to light.
      const next =
        e.matches || timeOfDay(new Date().getHours()) === "night"
          ? "dark"
          : "light";
      root.setAttribute("data-theme", next);
      setThemeState(next);
    };
    mq.addEventListener("change", onOSChange);
    return () => mq.removeEventListener("change", onOSChange);
  }, []);

  function toggle() {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // persistence is best-effort
    }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label="Toggle day and night"
      aria-pressed={theme === "dark"}
      title="Toggle day and night"
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
