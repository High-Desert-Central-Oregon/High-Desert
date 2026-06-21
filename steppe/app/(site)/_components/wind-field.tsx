"use client";

import { useEffect, useRef } from "react";

/**
 * Day-mode wind for the landing hero — a Canvas particle field (the wind-js
 * advection technique, implemented lean and procedurally; no GFS data, no map).
 * Particles drift over a procedural flow field (layered sines, predominantly the
 * rightward high-desert drift), leaving short fading trails via destination-out
 * fade on a transparent canvas, so the hero shows through. Visual layer only.
 *
 * Runs only when the DAY sky is showing — light theme and data-time day (a
 * fainter pass at dawn/dusk); it stops and clears whenever the night sky is up
 * (dark theme or data-time night) so the stars keep the sky. Disabled entirely
 * under prefers-reduced-motion. The rAF loop is cancelled when the hero is
 * offscreen or the tab is hidden, and everything is torn down on unmount.
 *
 * Tunables mirror _design-source/steppe-wind-hero.html.
 */
const PARTICLE_DENSITY = 0.65; // particles per px of width (capped)
const MAX_PARTICLES = 720;
const SPEED = 0.75; // base drift px/frame
const FADE = 0.92; // trail persistence
const SKY_FRAC = 0.75; // confined to the top fraction of the hero
const TINT = "251,247,238"; // warm paper white
const ALPHA_MIN = 0.25;
const ALPHA_MAX = 0.65;

type Particle = { x: number; y: number; life: number; a: number };

export function WindField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = ref.current;
    const host = cvs?.parentElement;
    const ctx = cvs?.getContext("2d");
    if (!cvs || !host || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let frame = 0;
    let raf: number | null = null;
    let onScreen = true;
    let particles: Particle[] = [];

    const spawn = (): Particle => ({
      x: Math.random() * w,
      y: Math.random() * h * SKY_FRAC,
      life: 60 + Math.random() * 160,
      a: ALPHA_MIN + Math.random() * (ALPHA_MAX - ALPHA_MIN),
    });

    const resize = () => {
      const r = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      if (w === 0 || h === 0) return;
      cvs.width = Math.round(w * dpr);
      cvs.height = Math.round(h * dpr);
      cvs.style.width = `${w}px`;
      cvs.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(MAX_PARTICLES, Math.floor(w * PARTICLE_DENSITY));
      particles = new Array(count).fill(0).map(spawn);
    };

    const flow = (x: number, y: number) => {
      const u =
        SPEED *
        (1.1 +
          0.45 * Math.sin(y * 0.013 + frame * 0.0007) +
          0.3 * Math.sin(x * 0.006 - frame * 0.001));
      const v =
        0.55 * Math.sin(x * 0.01 + y * 0.009 + frame * 0.0009) +
        0.2 * Math.sin(y * 0.02 - frame * 0.0006);
      return { u, v };
    };

    // The day sky only shows in light theme; dawn/dusk get a fainter pass.
    const skyState = (): "day" | "soft" | "off" => {
      const root = document.documentElement;
      if (root.getAttribute("data-theme") === "dark") return "off";
      const tod = root.getAttribute("data-time");
      if (tod === "day") return "day";
      if (tod === "dawn" || tod === "dusk") return "soft";
      return "off";
    };

    const clear = () => ctx.clearRect(0, 0, cvs.width, cvs.height);

    const step = () => {
      frame++;
      const scale = skyState() === "soft" ? 0.5 : 1;
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = `rgba(0,0,0,${1 - FADE})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = 1;
      for (const p of particles) {
        const px = p.x;
        const py = p.y;
        const { u, v } = flow(p.x, p.y);
        p.x += u;
        p.y += v;
        p.life--;
        ctx.strokeStyle = `rgba(${TINT},${p.a * scale})`;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        if (p.x > w + 4 || p.y < -4 || p.y > h * SKY_FRAC + 4 || p.life <= 0) {
          Object.assign(p, spawn(), { x: -4 });
        }
      }
      raf = requestAnimationFrame(step);
    };

    const start = () => {
      if (raf === null) raf = requestAnimationFrame(step);
    };
    const stop = () => {
      if (raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    };
    // Decide run vs. stop from every signal (theme/time, visibility, viewport).
    const update = () => {
      if (reduce || !onScreen || document.hidden || w === 0 || skyState() === "off") {
        stop();
        clear();
        return;
      }
      start();
    };

    resize();
    update();

    const ro = new ResizeObserver(() => {
      resize();
      update();
    });
    ro.observe(host);

    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries[0]?.isIntersecting ?? true;
        update();
      },
      { threshold: 0 },
    );
    io.observe(host);

    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-time"],
    });

    const onVis = () => update();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} className="windcanvas" aria-hidden="true" />;
}
