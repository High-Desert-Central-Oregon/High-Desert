"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * PreviewEmbed — embeds the finished Steppe app (a self-contained Claude Design
 * export at public/preview-app/steppe-exchange.html) on the /preview page as a
 * live, interactive preview.
 *
 * The export is a RUNTIME BUNDLE (inlined fonts + JS, fully offline) rendering the
 * real Exchange app — four tabs, messages, compose, governance, EN/ES. It is NOT
 * ported into React; it is embedded as-is in an <iframe>. To refresh the preview,
 * re-export from Claude Design and overwrite the HTML file (see
 * public/preview-app/README.md). Bump APP_SRC's ?v= if a deploy is cached.
 *
 * Two states:
 *  - Inline (default): a paper-backed phone frame at a comfortable size. The export
 *    centers a 402×872 phone with 40px of paper padding (≈482px of natural width),
 *    so on viewports narrower than that we scale-to-fit (transform) rather than let
 *    the page gain a horizontal scrollbar. The iframe's own overflow is clipped by
 *    the frame; the page never scrolls sideways.
 *  - Full screen: a mobile affordance (the trigger is hidden on desktop in
 *    preview.css, where the inline embed is the experience). A fixed overlay
 *    (role="dialog", aria-modal) filling the viewport in dvw/dvh units. The phone
 *    is scaled to fill the viewport as large as it can
 *    while staying fully visible, with the export's paper padding CROPPED off the
 *    edges — so on a phone-shaped screen the app runs edge-to-edge (a real
 *    facsimile, not a small mock on paper). Esc/X exit, body-scroll lock, focus
 *    trap + restore, and a best-effort native Fullscreen request layered on top.
 *
 * First-party, same-origin asset, so the iframe is NOT sandboxed — the event
 * "Add to calendar" .ics download depends on an un-sandboxed download.
 */

// Versioned src: bump the ?v= date after re-exporting if a CDN serves a stale copy.
const APP_SRC = "/preview-app/steppe-exchange.html?v=2026-06-22";

// Geometry of the export: a fixed PHONE_W×PHONE_H device centered inside PAD px of
// paper on every side (so the natural content box is BASE_W×BASE_H). Inline we fit
// the whole content box to the frame; full screen we fit just the PHONE, cropping
// the paper, so the app fills the screen.
const PAD = 40;
const PHONE_W = 402;
const PHONE_H = 872;
const BASE_W = PHONE_W + PAD * 2; // 482
const BASE_H = PHONE_H + PAD * 2; // 952

export function PreviewEmbed() {
  const t = useTranslations("preview");

  const [loaded, setLoaded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [scale, setScale] = useState(1);
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties | null>(
    null,
  );

  const viewRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const scrollYRef = useRef(0);

  // Scale-to-fit the inline frame: measure the visible width and shrink the iframe
  // so the phone never overflows a narrow viewport. Runs in an effect (SSR-safe).
  useEffect(() => {
    const el = viewRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const w = el.clientWidth;
      setScale(w > 0 ? Math.min(1, w / BASE_W) : 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const openFullscreen = useCallback(() => {
    if (typeof window !== "undefined") scrollYRef.current = window.scrollY;
    setFullscreen(true);
  }, []);

  const closeFullscreen = useCallback(() => {
    setFullscreen(false);
  }, []);

  // Full-screen lifecycle: body-scroll lock, Esc-to-close, focus into the overlay,
  // a focus trap that pulls stray focus back to the close button, focus restore to
  // the trigger on close, and a best-effort native Fullscreen request/exit.
  useEffect(() => {
    if (!fullscreen) return;
    if (typeof document === "undefined") return;

    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    // Capture the trigger now: it stays mounted behind the overlay, so this is the
    // element we return focus to on close (read in cleanup, hence captured here).
    const trigger = triggerRef.current;

    // Best-effort OS-level immersion; the overlay stands on its own if this fails.
    const overlay = overlayRef.current;
    if (overlay?.requestFullscreen) {
      overlay.requestFullscreen().catch(() => {});
    }

    // Move focus to the exit control once the overlay is mounted.
    closeRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeFullscreen();
      }
    };
    // Keep focus inside the overlay: if it escapes (e.g. tabbing past the iframe),
    // pull it back to the close button. Focus that lands inside the iframe keeps
    // the iframe element as the activeElement, which is within the overlay.
    const onFocusIn = (e: FocusEvent) => {
      const node = overlayRef.current;
      if (node && e.target instanceof Node && !node.contains(e.target)) {
        closeRef.current?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      body.style.overflow = prevOverflow;
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      // Restore scroll position and return focus to the trigger.
      window.scrollTo(0, scrollYRef.current);
      trigger?.focus();
    };
  }, [fullscreen, closeFullscreen]);

  // Full-screen sizing: scale the PHONE (not the padded content box) to fill the
  // overlay as large as it can while staying fully visible, centered, with the
  // export's paper padding cropped off the edges by the overlay's overflow. On a
  // phone-shaped viewport s≈viewportWidth/PHONE_W, so the app fills the width.
  // Recomputed on resize / rotate / entering native fullscreen via ResizeObserver.
  useEffect(() => {
    if (!fullscreen) return;
    const node = overlayRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const compute = () => {
      const W = node.clientWidth;
      const H = node.clientHeight;
      if (!W || !H) return;
      const s = Math.min(W / PHONE_W, H / PHONE_H);
      // Center the phone, then back out the PAD so the paper sits off-screen.
      const tx = (W - PHONE_W * s) / 2 - PAD * s;
      const ty = (H - PHONE_H * s) / 2 - PAD * s;
      setOverlayStyle({
        width: `${BASE_W}px`,
        height: `${BASE_H}px`,
        transform: `translate(${tx}px, ${ty}px) scale(${s})`,
        transformOrigin: "0 0",
      });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(node);
    return () => {
      ro.disconnect();
      setOverlayStyle(null); // fresh fade-in on the next open
    };
  }, [fullscreen]);

  const ExpandIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <div className="pe">
      <div className="pe-bar">
        <button
          ref={triggerRef}
          type="button"
          className="btn btn-primary pe-expand"
          onClick={openFullscreen}
          aria-label={t("embedExpand")}
        >
          {ExpandIcon}
          {t("embedExpand")}
        </button>
      </div>

      <div className="pe-view" ref={viewRef}>
        {!loaded && (
          <div className="pe-skeleton" role="status" aria-live="polite">
            <span className="pe-spinner" aria-hidden="true" />
            <span className="pe-skeleton-label">{t("embedLoading")}</span>
          </div>
        )}
        <iframe
          className="pe-iframe"
          src={APP_SRC}
          title={t("embedTitle")}
          onLoad={() => setLoaded(true)}
          style={{
            width: `${BASE_W}px`,
            height: `${100 / scale}%`,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
        <noscript>
          {/* Without JS the scale/overlay can't run; offer the app in a new tab. */}
          <a className="pe-noscript" href={APP_SRC} target="_blank" rel="noreferrer">
            {t("embedOpenNewTab")}
          </a>
        </noscript>
      </div>

      {fullscreen && (
        <div
          className="pe-overlay"
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-label={t("embedTitle")}
        >
          <iframe
            className="pe-overlay-iframe"
            src={APP_SRC}
            title={t("embedTitle")}
            style={{ ...(overlayStyle ?? {}), opacity: overlayStyle ? 1 : 0 }}
          />
          <button
            ref={closeRef}
            type="button"
            className="pe-x"
            onClick={closeFullscreen}
            aria-label={t("embedExit")}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
