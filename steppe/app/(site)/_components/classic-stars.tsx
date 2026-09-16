"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { shouldAnimateSky, type SkyConnection } from "@/lib/hero-motion";

// Seeded coordinates keep the server-rendered fallback and hydration identical.
// A jittered grid gives even coverage without looking like a repeating pattern.
const stars = Array.from({ length: 96 }, (_, i) => {
  const noise = (salt: number) => {
    let value = Math.imul(i + 1, 374761393) + Math.imul(salt, 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  };
  return {
    x: ((i % 16) + 0.05 + noise(1) * 0.9) * 6.25,
    y: (Math.floor(i / 16) + 0.1 + noise(2) * 0.8) * 16,
    size: i % 19 === 0 ? 2.5 : 0.9 + noise(3) * 1.1,
    opacity: 0.3 + noise(4) * 0.55,
  };
});

export function ClassicStars() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host || !("IntersectionObserver" in window)) return;
    const root = document.documentElement;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (
      navigator as Navigator & { connection?: SkyConnection & EventTarget }
    ).connection;
    let visible = false;
    let active = false;
    let generation = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopAnimation: (() => void) | undefined;

    const stop = () => {
      generation++;
      active = false;
      clearTimeout(timer);
      stopAnimation?.();
      stopAnimation = undefined;
    };
    const sync = () => {
      const navigation = performance.getEntriesByType("navigation")[0] as
        PerformanceNavigationTiming | undefined;
      const eligible =
        visible &&
        !document.hidden &&
        root.dataset.theme === "dark" &&
        shouldAnimateSky({
          reducedMotion: motion.matches,
          online: navigator.onLine,
          connection,
          responseTime: navigation
            ? navigation.responseEnd - navigation.requestStart
            : 0,
        });
      if (!eligible) return stop();
      if (active) return;
      active = true;
      const current = ++generation;
      // Give the page a first paint before requesting the optional library chunk.
      timer = setTimeout(() => {
        import("./classic-stars-motion")
          .then(({ animateClassicStars }) => {
            if (current === generation)
              stopAnimation = animateClassicStars(host);
          })
          .catch(() => {
            // Failed/blocked downloads leave the complete static sky in place.
            if (current === generation) stop();
          });
      }, 700);
    };
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    const theme = new MutationObserver(sync);
    intersection.observe(host);
    theme.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    motion.addEventListener("change", sync);
    connection?.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      stop();
      intersection.disconnect();
      theme.disconnect();
      motion.removeEventListener("change", sync);
      connection?.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return (
    <div className="classic-stars" ref={ref} aria-hidden="true">
      {stars.map((star, i) => (
        <span
          key={i}
          className={`classic-star${i % 19 === 0 ? " classic-star-bright" : ""}`}
          style={
            {
              left: `${star.x.toFixed(2)}%`,
              top: `${star.y.toFixed(2)}%`,
              "--star-size": `${star.size.toFixed(2)}px`,
              "--star-opacity": star.opacity.toFixed(2),
            } as CSSProperties
          }
        />
      ))}
      <span className="classic-meteor">
        <span />
      </span>
    </div>
  );
}
