"use client";

import { useEffect, useRef } from "react";
import type { Container, ISourceOptions } from "@tsparticles/engine";
import { tsParticles } from "@tsparticles/engine";
import { loadSlim } from "@tsparticles/slim";
import { gsap } from "gsap";
import { modeFor, intensityFor, type Weather, type Mode } from "@/lib/weather";

/**
 * The moving-weather layer for the generative hero — the agreed library hybrid,
 * locked to live Redmond conditions (no toggles):
 *   tsParticles → wind / rain / snow / haze,
 *   GSAP        → drifting clouds (the shader already draws the sun/moon — no second sun),
 *   Vanta FOG   → fog only, lazy-imported (three never enters the initial bundle).
 *
 * Wind-cutoff fix: the layer is full-bleed over the whole hero band, sized by a
 * ResizeObserver with devicePixelRatio awareness (tsParticles detectRetina), and the
 * wind/rain emitters sit just OFF the left/top edge so streaks enter from beyond the
 * frame and exit beyond the right/bottom — never spawned or clipped inside view.
 * pointer-events:none throughout (it never blocks text/links). It pauses when offscreen
 * (IntersectionObserver) and, under prefers-reduced-motion, renders a single static frame.
 */

let slimLoaded = false;
async function ensureEngine() {
  if (!slimLoaded) {
    await loadSlim(tsParticles);
    slimLoaded = true;
  }
}

// Mono tints per mode (kept subtle; tuned visually on the deploy).
function buildOptions(mode: Mode, intensity: number, slant: number, reduce: boolean): ISourceOptions {
  const common: ISourceOptions = {
    fullScreen: { enable: false },
    detectRetina: true,
    fpsLimit: 60,
    pauseOnOutsideViewport: true,
    pauseOnBlur: true,
    background: { color: "transparent" },
  };

  if (mode === "rain") {
    const n = Math.round(60 + intensity * 90);
    return {
      ...common,
      particles: {
        number: { value: n },
        color: { value: "#b0c4d6" },
        opacity: { value: { min: 0.18, max: 0.42 } },
        size: { value: { min: 6, max: 12 } },
        shape: { type: "line" },
        stroke: { width: 1.2, color: "#b0c4d6" },
        move: {
          enable: !reduce,
          direction: "bottom",
          straight: true,
          speed: { min: 16, max: 26 },
          angle: { offset: slant * 14, value: 0 },
          outModes: { default: "destroy", bottom: "destroy", top: "none" },
        },
      },
      emitters: [
        {
          position: { x: 50, y: -4 },
          size: { width: 120, height: 0 },
          rate: { delay: 0.06, quantity: Math.round(2 + intensity * 3) },
          particles: { move: { direction: "bottom" } },
        },
      ],
    };
  }

  if (mode === "snow") {
    const n = Math.round(40 + intensity * 70);
    return {
      ...common,
      particles: {
        number: { value: n },
        color: { value: "#f6f7fa" },
        opacity: { value: { min: 0.5, max: 0.9 } },
        size: { value: { min: 1.5, max: 3.5 } },
        shape: { type: "circle" },
        move: {
          enable: !reduce,
          direction: "bottom",
          straight: false,
          speed: { min: 1, max: 2.4 },
          drift: slant * 1.2,
          outModes: { default: "destroy", bottom: "destroy", top: "none" },
        },
        wobble: { enable: !reduce, distance: 8, speed: { min: -4, max: 4 } },
      },
      emitters: [
        {
          position: { x: 50, y: -4 },
          size: { width: 120, height: 0 },
          rate: { delay: 0.18, quantity: Math.round(2 + intensity * 2) },
          particles: { move: { direction: "bottom" } },
        },
      ],
    };
  }

  if (mode === "fog") {
    // Vanta owns fog; tsParticles stays empty here.
    return { ...common, particles: { number: { value: 0 } } };
  }

  // wind / haze (the default, clear-ish breeze): horizontal streaks entering off-left.
  const haze = mode === "wind" && intensity < 0.5;
  const n = Math.round(haze ? 30 : 60 + intensity * 50);
  return {
    ...common,
    particles: {
      number: { value: n },
      color: { value: "#fbf7ee" },
      opacity: { value: { min: 0.06, max: haze ? 0.16 : 0.4 } },
      size: { value: { min: 8, max: 16 } },
      shape: { type: "line" },
      stroke: { width: 1.1, color: "#fbf7ee" },
      move: {
        enable: !reduce,
        direction: "right",
        straight: true,
        speed: { min: haze ? 1.2 : 3, max: haze ? 3 : 8 },
        outModes: { default: "destroy", right: "destroy", left: "none" },
      },
    },
    emitters: [
      {
        // Off the left edge → particles enter from beyond the frame, exit beyond right.
        position: { x: -4, y: 50 },
        size: { width: 0, height: 120 },
        rate: { delay: haze ? 0.3 : 0.12, quantity: haze ? 1 : 2 },
        particles: { move: { direction: "right" } },
      },
    ],
  };
}

const CLOUD_SVG =
  '<svg width="120" height="48" viewBox="0 0 120 48" fill="#FBF7EE" aria-hidden="true">' +
  '<ellipse cx="38" cy="30" rx="34" ry="16"/><ellipse cx="66" cy="24" rx="28" ry="18"/>' +
  '<ellipse cx="90" cy="31" rx="24" ry="14"/></svg>';

export function WeatherLayer({ weather }: { weather: Weather | null }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const cloudsRef = useRef<HTMLDivElement>(null);
  const fogRef = useRef<HTMLDivElement>(null);

  const code = weather?.weather_code ?? 1;
  const cloud = (weather?.cloud_cover ?? 25) / 100;
  // meteorological "from" direction → a horizontal slant sign for rain/wind.
  const dir = weather?.wind_direction_10m ?? 295;
  const slant = Math.sin(((dir + 180) * Math.PI) / 180) >= 0 ? 1 : -1;

  // ---- tsParticles (wind / rain / snow / haze) ----
  useEffect(() => {
    const el = particlesRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mode = modeFor(code);
    const intensity = intensityFor(code);
    let container: Container | undefined;
    let cancelled = false;

    (async () => {
      await ensureEngine();
      if (cancelled) return;
      container = await tsParticles.load({
        element: el,
        options: buildOptions(mode, intensity, slant, reduce),
      });
      // Reduced motion: draw one frame, then freeze.
      if (reduce && container) container.pause();
    })();

    return () => {
      cancelled = true;
      container?.destroy();
    };
  }, [code, slant]);

  // ---- GSAP drifting clouds (cloud-cover driven; no sun) ----
  useEffect(() => {
    const layer = cloudsRef.current;
    if (!layer) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const n = code === 45 || code === 48 ? 0 : Math.round(cloud * 6);
    layer.innerHTML = "";
    const tweens: gsap.core.Tween[] = [];
    for (let i = 0; i < n; i++) {
      const c = document.createElement("div");
      c.className = "wx-cloud";
      c.style.top = `${4 + Math.random() * 42}%`;
      c.style.opacity = `${(0.3 + Math.random() * 0.28).toFixed(2)}`;
      c.style.transform = `scale(${(0.55 + Math.random() * 0.8).toFixed(2)})`;
      c.innerHTML = CLOUD_SVG;
      layer.appendChild(c);
      if (reduce) {
        c.style.left = `${5 + Math.random() * 75}%`;
        continue;
      }
      tweens.push(
        gsap.fromTo(
          c,
          { xPercent: -140 },
          {
            xPercent: 520,
            duration: 46 + Math.random() * 46,
            delay: Math.random() * -60,
            ease: "none",
            repeat: -1,
          },
        ),
      );
    }
    return () => {
      tweens.forEach((tw) => tw.kill());
      layer.innerHTML = "";
    };
  }, [code, cloud]);

  // ---- Vanta FOG (lazy; only when foggy) ----
  useEffect(() => {
    const el = fogRef.current;
    if (!el) return;
    const foggy = code === 45 || code === 48;
    if (!foggy) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Static fog tint instead of the animated three.js effect.
      el.style.background =
        "linear-gradient(180deg, rgba(228,226,219,0.5), rgba(228,226,219,0.15))";
      return;
    }
    let effect: { destroy: () => void } | null = null;
    let cancelled = false;
    (async () => {
      // Lazy so three.js never enters the initial bundle — loaded only when foggy.
      const [{ default: FOG }, THREE] = await Promise.all([
        import("vanta/dist/vanta.fog.min"),
        import("three"),
      ]);
      if (cancelled) return;
      effect = FOG({
        el,
        THREE,
        mouseControls: false,
        touchControls: false,
        gyroControls: false,
        highlightColor: 0xe4e2db,
        midtoneColor: 0xc8c6bf,
        lowlightColor: 0x9aa39a,
        baseColor: 0xede6d5,
        blurFactor: 0.6,
        speed: 0.8,
        zoom: 0.7,
      });
    })();
    return () => {
      cancelled = true;
      effect?.destroy();
      el.style.background = "";
    };
  }, [code]);

  return (
    <div className="wx-layer" ref={rootRef} aria-hidden="true">
      <div className="wx-clouds" ref={cloudsRef}></div>
      <div className="wx-fog" ref={fogRef}></div>
      <div className="wx-particles" ref={particlesRef}></div>
    </div>
  );
}
