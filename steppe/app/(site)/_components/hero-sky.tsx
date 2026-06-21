"use client";

import { useEffect, useRef } from "react";

/**
 * Hero atmosphere — the day/night sky layers for the landing hero, faithful to
 * _design-source/steppe-mobile-hero-v2.html (makeWind / meteor / shower).
 *
 * Three primitives, all gated by data-theme / data-time on <html> and disabled
 * under prefers-reduced-motion:
 *  - WindCanvas — particle-advection wind (a turbulent, gusty flow field, not a
 *    uniform stream). Day-only.
 *  - StarLayer  — static twinkling dots (the quiet base) plus a randomized meteor
 *    shower via the Web Animations API. Night-only; meteors never scheduled under
 *    reduced motion.
 *  - SunOrb     — a true-circle sun (day) / moon (night) as its own overlay, so it
 *    is never squashed by the stretch-to-fill landscape SVG on the short mobile
 *    band (the sky + hills can keep stretching; only the celestial body must keep
 *    a real aspect ratio).
 *
 * Each layer takes an `activeQuery` so the same primitives serve both the desktop
 * scene (one whole-hero wind) and the mobile scene (band + subtle hero passes),
 * without either running while hidden at the other breakpoint.
 */

type WindOpts = {
  density?: number;
  max?: number;
  speed?: number;
  fade?: number;
  sky?: number;
  aMin?: number;
  aMax?: number;
  tint?: string;
};
type Particle = { x: number; y: number; life: number; a: number; spd: number };

const rand = (a: number, b: number) => a + Math.random() * (b - a);

// Stable config references (module-level so they don't re-trigger effects). Kept
// client-side and selected by a `variant` string, so the server component only
// passes serializable props across the client boundary.
//
// Desktop: one natural wind across the whole hero, warm white, sits behind the
// copy and the landscape (matches the prior whole-hero pass, now turbulent).
// Mobile band: present but inconsistent — slow gusty drift, warm white, the
// visible day wind in the divider band.
// Mobile hero copy area: day's answer to the night stars — very subtle, a darker
// tint so it reads on the light hero, sparse so it never competes with the text.
const WIND_VARIANTS: Record<string, { config: WindOpts; query: string }> = {
  desktop: {
    query: "(min-width: 861px)",
    config: { density: 0.5, max: 640, speed: 0.5, fade: 0.92, sky: 0.72, aMin: 0.14, aMax: 0.5, tint: "251,247,238" },
  },
  band: {
    query: "(max-width: 860px)",
    config: { density: 1.1, max: 380, speed: 0.5, fade: 0.92, sky: 0.62, aMin: 0.14, aMax: 0.55, tint: "251,247,238" },
  },
  hero: {
    query: "(max-width: 860px)",
    config: { density: 0.42, max: 150, speed: 0.3, fade: 0.95, sky: 1.0, aMin: 0.04, aMax: 0.12, tint: "90,104,80" },
  },
};

function makeWind(cvs: HTMLCanvasElement, opt: WindOpts) {
  const ctx = cvs.getContext("2d");
  let W = 0,
    H = 0,
    DPR = 1,
    P: Particle[] = [],
    raf: number | null = null,
    t = 0;
  const o = {
    density: 1.1,
    max: 380,
    speed: 0.5,
    fade: 0.92,
    sky: 0.62,
    aMin: 0.14,
    aMax: 0.55,
    tint: "251,247,238",
    ...opt,
  };
  const spawn = (): Particle => ({
    x: Math.random() * W,
    y: Math.random() * H * o.sky,
    life: 40 + Math.random() * 180,
    a: rand(o.aMin, o.aMax),
    spd: rand(0.35, 1.9), // per-particle speed: some crawl, some move
  });
  const size = () => {
    const r = cvs.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width;
    H = r.height;
    if (W === 0 || H === 0) return;
    cvs.width = (W * DPR) | 0;
    cvs.height = (H * DPR) | 0;
    cvs.style.width = W + "px";
    cvs.style.height = H + "px";
    ctx!.setTransform(DPR, 0, 0, DPR, 0, 0);
    P = Array.from({ length: Math.min(o.max, (W * o.density) | 0) }, spawn);
  };
  // Gust envelope: overall strength ebbs and flows over time (layered slow sines),
  // so the wind surges and lulls rather than blowing at one constant rate.
  const gust = () => {
    const g =
      0.45 +
      0.36 * Math.sin(t * 0.0006) +
      0.22 * Math.sin(t * 0.0013 + 1.7) +
      0.12 * Math.sin(t * 0.0027 + 0.4);
    return g < 0.1 ? 0.1 : g;
  };
  // Turbulent direction: the flow angle wanders across space and slowly over time,
  // biased to drift across — streaks fan out instead of marching in lockstep.
  const field = (x: number, y: number): [number, number] => {
    const a =
      1.4 * Math.sin(x * 0.01 + y * 0.014 + t * 0.0006) +
      1.0 * Math.sin(y * 0.022 - x * 0.006 + t * 0.0009) +
      0.6 * Math.sin((x + y) * 0.017 + t * 0.0004);
    const ang = a * 0.38,
      sp = o.speed * gust();
    return [sp * (0.8 + 0.6 * Math.cos(ang)), sp * 0.95 * Math.sin(ang)];
  };
  const step = () => {
    if (!ctx) return;
    t++;
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0," + (1 - o.fade) + ")";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = 1.1;
    for (const p of P) {
      const px = p.x,
        py = p.y,
        f = field(p.x, p.y);
      p.x += f[0] * p.spd;
      p.y += f[1] * p.spd;
      p.life--;
      ctx.strokeStyle = "rgba(" + o.tint + "," + p.a + ")";
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      if (p.x > W + 5 || p.x < -24 || p.y < -8 || p.y > H * o.sky + 8 || p.life <= 0)
        Object.assign(p, spawn(), { x: -rand(0, 18) });
    }
    raf = requestAnimationFrame(step);
  };
  return {
    on() {
      if (!raf) {
        size();
        if (W > 0) raf = requestAnimationFrame(step);
      }
    },
    off() {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = null;
      }
      try {
        ctx?.clearRect(0, 0, cvs.width, cvs.height);
      } catch {
        // canvas may be 0-sized while hidden; nothing to clear
      }
    },
    resize() {
      if (raf) size();
    },
  };
}

export function WindCanvas({
  className,
  variant,
}: {
  className: string;
  variant: "desktop" | "band" | "hero";
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { config, query } = WIND_VARIANTS[variant];
    const wind = makeWind(cvs, config);
    const root = document.documentElement;
    const mql = window.matchMedia(query);
    const host = cvs.parentElement ?? cvs;
    let onScreen = true;

    // Day-only: light theme + data-time day. Manual dark override stops the wind.
    const isDay = () =>
      root.getAttribute("data-theme") !== "dark" &&
      root.getAttribute("data-time") === "day";
    const update = () => {
      if (reduce || document.hidden || !onScreen || !mql.matches || !isDay())
        wind.off();
      else wind.on();
    };

    update();
    const ro = new ResizeObserver(() => {
      wind.resize();
      update();
    });
    ro.observe(host);
    const io = new IntersectionObserver(
      (e) => {
        onScreen = e[0]?.isIntersecting ?? true;
        update();
      },
      { threshold: 0 },
    );
    io.observe(host);
    const mo = new MutationObserver(update);
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme", "data-time"] });
    const onVis = () => update();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    mql.addEventListener("change", update);

    return () => {
      wind.off();
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
      mql.removeEventListener("change", update);
    };
  }, [variant]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

export function StarLayer({
  className,
  count,
  meteor = false,
  meteorMin = 650,
  meteorMax = 3200,
  doubleChance = 0,
  activeQuery,
}: {
  className: string;
  count: number;
  meteor?: boolean;
  meteorMin?: number;
  meteorMax?: number;
  doubleChance?: number;
  activeQuery: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Static twinkle dots — varied sizes, inserted client-side (no hydration mismatch).
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.querySelectorAll(".dot").forEach((d) => d.remove());
    let html = "";
    for (let i = 0; i < count; i++) {
      const s = rand(1, 2.6).toFixed(1);
      html += `<span class="dot" style="width:${s}px;height:${s}px;top:${(
        Math.random() * 72
      ).toFixed(1)}%;left:${(Math.random() * 100).toFixed(1)}%;animation-delay:${rand(
        0,
        4,
      ).toFixed(1)}s"></span>`;
    }
    host.insertAdjacentHTML("beforeend", html);
    return () => {
      host.querySelectorAll(".dot").forEach((d) => d.remove());
    };
  }, [count]);

  // Meteor shower — every streak randomizes size, tail, speed, angle and brightness,
  // fired on irregular gaps (not a metronome). Night-only; never under reduced motion.
  useEffect(() => {
    if (!meteor) return;
    const host = ref.current;
    if (!host) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return; // do not schedule meteors at all
    const root = document.documentElement;
    const mql = window.matchMedia(activeQuery);
    let timer: number | null = null;
    let alive = true;

    const fire = () => {
      const r = host.getBoundingClientRect();
      if (r.width === 0) return;
      const big = Math.random() < 0.16; // occasional brighter, longer one
      const len = big ? rand(120, 190) : rand(38, 110);
      const thick = big ? rand(1.8, 2.6) : rand(0.8, 1.8);
      const dur = rand(820, 2500) * (big ? 1.25 : 1);
      const ang = rand(12, 26); // shared radiant, slight spread
      const bright = big ? rand(0.8, 1) : rand(0.3, 0.8);
      const dist = rand(120, 250) + len * 0.4;
      const x = rand(-len * 0.3, r.width * 0.72),
        y = rand(0, r.height * 0.42);
      const el = document.createElement("span");
      el.className = "meteor";
      el.style.cssText = `width:${len}px;height:${thick}px;left:${x}px;top:${y}px`;
      if (big) el.style.boxShadow = "0 0 6px rgba(237,230,213,.7)";
      host.appendChild(el);
      const rad = (ang * Math.PI) / 180,
        dx = dist * Math.cos(rad),
        dy = dist * Math.sin(rad);
      const anim = el.animate(
        [
          { opacity: 0, transform: `translate(0,0) rotate(${ang}deg)` },
          { opacity: bright, offset: 0.1 },
          { opacity: bright, offset: 0.72 },
          { opacity: 0, transform: `translate(${dx}px,${dy}px) rotate(${ang}deg)` },
        ],
        { duration: dur, easing: "linear" },
      );
      anim.onfinish = () => el.remove();
    };

    const tick = () => {
      if (!alive) return;
      if (mql.matches && root.getAttribute("data-theme") === "dark") {
        fire();
        if (doubleChance > 0 && Math.random() < doubleChance) fire(); // rare quick double
      }
      timer = window.setTimeout(tick, rand(meteorMin, meteorMax));
    };
    timer = window.setTimeout(tick, rand(400, 1400));

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      host.querySelectorAll(".meteor").forEach((m) => m.remove());
    };
  }, [meteor, activeQuery, meteorMin, meteorMax, doubleChance]);

  return <div ref={ref} className={className} aria-hidden="true" />;
}

export function SunOrb() {
  return (
    <div className="sun-orb" aria-hidden="true">
      <div className="orb-halo"></div>
      <div className="orb-disc"></div>
    </div>
  );
}
