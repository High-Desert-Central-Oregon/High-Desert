"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Chromium's install event — not in lib.dom, so declared here. Firing is the
 * browser's signal that the app is installable (manifest + SW criteria met).
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/**
 * Dismissal marker for the install BANNER. DISPLAY-STATE, NOT TRUST-STATE:
 * this records only "the member said 'not now' to a piece of chrome" — it
 * grants nothing, gates nothing server-side, and losing it merely shows the
 * banner again. That is why localStorage is acceptable here despite the
 * no-localStorage-for-trust invariant (CLAUDE.md: the server and DB hold
 * truth; this is neither). Permanent on purpose — no re-prompt window; the
 * You-tab row remains the always-available door.
 */
const DISMISS_KEY = "hd_install_dismissed";

/**
 * One shared source of install truth for every affordance (the banner above
 * the nav and the You-tab row):
 *
 *  - ANDROID/CHROMIUM: listens for `beforeinstallprompt`, calls
 *    preventDefault() — suppressing Chrome's own mini-infobar in favor of our
 *    letterpress affordance is the point — and stashes the event.
 *    promptInstall() replays it (single-use; cleared after the choice).
 *    `appinstalled` marks installed.
 *  - iOS/iPadOS: no event exists; installation is manual (Share → Add to Home
 *    Screen), so we only *detect* the family. iPad-safely: iPadOS 13+ reports
 *    a Macintosh UA, so /iphone|ipad|ipod/ alone silently drops every iPad —
 *    instead: ('standalone' in navigator) — a Safari-only property — OR a
 *    Macintosh UA with real touch (navigator.maxTouchPoints > 1).
 *  - INSTALLED: display-mode standalone (or navigator.standalone on iOS)
 *    means we're already inside the installed app — affordances render null.
 *
 * All detection runs in effects (client-only, post-mount) so server render
 * and hydration see one stable "render nothing" state — no SSR mismatch.
 */
export function useInstallPrompt() {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      nav.standalone === true;
    setInstalled(standalone);
    setIsIOS(
      !standalone &&
        ("standalone" in navigator ||
          (navigator.maxTouchPoints > 1 &&
            /Macintosh/.test(navigator.userAgent))),
    );
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) !== null);
    } catch {
      // Storage unavailable (private mode etc.) — just show the banner.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // keep Chrome's own banner out of the way
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    // A stashed event is single-use whatever the member chose; if they
    // accepted, `appinstalled` fires and marks us installed.
    setDeferred(null);
  }, [deferred]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {
      // Session-only dismissal is fine if storage is unavailable.
    }
  }, []);

  return {
    /** False until mounted — render nothing before this is true. */
    ready,
    /** Already running as (or just became) the installed app. */
    installed,
    /** A stashed Chromium prompt is ready to replay. */
    canPrompt: deferred !== null,
    /** iOS/iPadOS family (manual Share → Add to Home Screen path). */
    isIOS,
    /** The member said "not now" to the banner (the You-row ignores this). */
    dismissed,
    promptInstall,
    dismiss,
  };
}
