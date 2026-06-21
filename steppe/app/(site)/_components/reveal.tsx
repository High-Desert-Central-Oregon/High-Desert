"use client";

import { useEffect } from "react";

/**
 * Reveal-on-scroll for the marketing pages. Mirrors the design's Intersection
 * Observer: each `.rv` element fades/rises in as it enters the viewport, with a
 * small stagger. Renders nothing; drop one <Reveal /> on any page that uses .rv.
 *
 * No-JS safe: the .rv hidden state is gated behind html[data-js] in CSS, so with
 * JS disabled (no data-js set) content is fully visible. Reduced-motion safe:
 * under prefers-reduced-motion we simply mark everything revealed at once.
 */
export function Reveal() {
  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(".site-root .rv"),
    );
    if (els.length === 0) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.14 },
    );
    els.forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i % 4, 3) * 70}ms`;
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  return null;
}
