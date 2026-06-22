"use client";

import { useEffect, useRef } from "react";
import { animate } from "animejs";

/**
 * Hero atmosphere for the landing hero — a live, weather-driven daytime scene plus
 * the night sky, faithful to _design-source/steppe-weather-hero.html.
 *
 * Daytime (data-time === "day") is driven by live Central Oregon conditions read
 * from /api/weather (a server-side, cached Open-Meteo proxy — the browser never
 * calls a third party). The canvas renders one of four purpose-built modes chosen
 * by weather_code — wind | rain | snow | fog — each crisp on its own; only wind
 * uses fading trails, the others clear each frame. Direction/speed/gust ease toward
 * the live targets, and wind turbulence scales with wind speed so a gentle breeze
 * drifts nearly straight and even across the full width.
 *
 * Two canvas surfaces: the band (full weather expression) and a subtle ambient
 * drift across the hero copy area (wind-only, faint, dark tint). anime.js drifts
 * the clouds and reveals the readout; the sun softens + the sky mutes with cloud
 * cover. Night keeps the moon (SunOrb) and the shooting stars (StarLayer).
 *
 * All animation is day-only and disabled under prefers-reduced-motion (a single
 * still frame is drawn instead). If /api/weather fails, the scene eases into a
 * calm default breeze rather than erroring.
 */

type Mode = "wind" | "rain" | "snow" | "fog";
type Weather = {
  wind_speed_10m: number;
  wind_gusts_10m?: number;
  wind_direction_10m: number;
  cloud_cover?: number;
  weather_code: number;
  temperature_2m: number;
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

// ---- shared, smoothed weather state (one hero per page) ----
// `target` is what the live data sets; `cur` eases toward it per frame so changes
// on refresh glide in. Read by every canvas surface + the cloud direction.
const target = {
  dir: [1, 0.05] as [number, number],
  speed: 0.5,
  gust: 0.5,
  cloud: 0.25,
  mode: "wind" as Mode,
  intensity: 0.6,
};
const cur = { dir: [1, 0.05] as [number, number], speed: 0.5, gust: 0.5 };

// ---- weather code → mode / intensity / labels ----
function modeFor(c: number): Mode {
  if ([45, 48].includes(c)) return "fog";
  if ([71, 73, 75, 77, 85, 86].includes(c)) return "snow";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(c))
    return "rain";
  return "wind";
}
function intensityFor(c: number) {
  if ([55, 65, 67, 75, 82, 86, 95, 96, 99, 77].includes(c)) return 1;
  if ([53, 63, 73, 81, 85, 56, 66].includes(c)) return 0.7;
  return 0.45;
}
function codeLabel(c: number) {
  if (c === 0) return "clear";
  if (c <= 2) return "mostly clear";
  if (c === 3) return "overcast";
  if (c <= 48) return "fog";
  if (c <= 57) return "drizzle";
  if (c <= 67) return "rain";
  if (c <= 77) return "snow";
  if (c <= 82) return "showers";
  if (c <= 86) return "snow showers";
  return "thunderstorm";
}
const compass = (d: number) =>
  ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][
    Math.round(d / 22.5) % 16
  ];

// Push live conditions into `target`; returns the bits the readout needs.
function applyWeather(w: Weather) {
  const spd = w.wind_speed_10m;
  const gst = w.wind_gusts_10m ?? spd;
  const dir = w.wind_direction_10m;
  const cloud = (w.cloud_cover ?? 30) / 100;
  const code = w.weather_code;
  // meteorological "from" → screen vector, with a horizontal bias for the wide band
  const to = ((dir + 180) * Math.PI) / 180;
  let vx = Math.sin(to);
  let vy = -Math.cos(to);
  vx = Math.abs(vx) < 0.25 ? Math.sign(vx || 1) * 0.25 : vx;
  vy *= 0.32;
  const m = Math.hypot(vx, vy) || 1;
  target.dir = [vx / m, vy / m];
  target.speed = 0.22 + clamp(spd / 30, 0, 1) * 1.25;
  target.gust = 0.25 + clamp((gst - spd) / 14, 0, 1) * 0.9;
  target.cloud = clamp(cloud, 0, 1);
  target.mode = modeFor(code);
  target.intensity = intensityFor(code);
  return { spd, gst, dir, code, temp: w.temperature_2m };
}

// ===========================================================================
// Canvas atmosphere engine — one instance per surface. Reads target/cur.
// ===========================================================================
type FieldOpts = { subtle?: boolean; sky?: number; tint?: string; aMin?: number; aMax?: number };
type WindP = { x: number; y: number; life: number; a: number; spd: number };
type RainP = { x: number; y: number; len: number; spd: number; a: number };
type SnowP = { x: number; y: number; r: number; spd: number; ph: number; sw: number; a: number };
type FogP = { x: number; y: number; r: number; dx: number; a: number };
type AnyP = WindP | RainP | SnowP | FogP;

function makeField(cvs: HTMLCanvasElement, opt: FieldOpts) {
  const o = { subtle: false, sky: 0.66, tint: "251,247,238", aMin: 0.14, aMax: 0.55, ...opt };
  const ctx = cvs.getContext("2d");
  let W = 0,
    H = 0,
    DPR = 1,
    P: AnyP[] = [],
    raf: number | null = null,
    t = 0,
    cmode: Mode = "wind";
  // The subtle hero-copy surface only ever runs wind; the band follows the mode.
  const emode = (): Mode => (o.subtle ? "wind" : target.mode);

  const windP = (): WindP => ({
    x: rnd(0, W),
    y: rnd(0, H * o.sky),
    life: 40 + Math.random() * 180,
    a: rnd(o.aMin, o.aMax),
    spd: rnd(0.4, 1.8),
  });
  const rainP = (): RainP => ({
    x: rnd(-40, W + 40),
    y: rnd(-H, H),
    len: rnd(9, 15) * (0.7 + target.intensity),
    spd: rnd(7, 12) * (0.6 + 0.6 * target.intensity),
    a: rnd(0.14, 0.4),
  });
  const snowP = (): SnowP => ({
    x: rnd(0, W),
    y: rnd(-H, H),
    r: rnd(1, 2.7),
    spd: rnd(0.5, 1.5),
    ph: rnd(0, 6.28),
    sw: rnd(0.3, 1),
    a: rnd(0.5, 0.9),
  });
  const fogP = (): FogP => ({
    x: rnd(0, W),
    y: rnd(H * 0.12, H * 0.62),
    r: rnd(42, 92),
    dx: rnd(0.08, 0.4) * (cur.dir[0] >= 0 ? 1 : -1),
    a: rnd(0.04, 0.1),
  });
  const make = (m: Mode): AnyP =>
    m === "rain" ? rainP() : m === "snow" ? snowP() : m === "fog" ? fogP() : windP();
  function count(m: Mode) {
    if (o.subtle) return Math.min(150, (W * 0.42) | 0);
    if (m === "rain") return Math.min(420, (W * 0.24 * (0.6 + target.intensity)) | 0);
    if (m === "snow") return Math.min(300, (W * 0.13 * (0.6 + target.intensity)) | 0);
    if (m === "fog") return 7;
    return Math.min(340, (W * clamp(0.8 + target.speed * 0.4, 0.8, 1.4)) | 0);
  }
  function reseed() {
    cmode = emode();
    P = Array.from({ length: count(cmode) }, () => make(cmode));
  }
  function size() {
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
    reseed();
  }

  // Gust envelope: strength ebbs and flows (layered slow sines).
  function gust() {
    const g =
      0.5 + 0.36 * Math.sin(t * 0.0006) + 0.22 * Math.sin(t * 0.0013 + 1.7) + 0.12 * Math.sin(t * 0.0027 + 0.4);
    return g < 0.12 ? 0.12 : g;
  }
  // Turbulence scales with wind speed: gentle → near-straight even drift (low turb,
  // no convergence pooling); windy → swirl.
  function windFieldAt(x: number, y: number): [number, number] {
    const turb =
      1.3 * Math.sin(x * 0.01 + y * 0.014 + t * 0.0006) +
      0.9 * Math.sin(y * 0.022 - x * 0.006 + t * 0.0009) +
      0.5 * Math.sin((x + y) * 0.017 + t * 0.0004);
    const wn = clamp(cur.speed / 1.6, 0, 1);
    const amt = o.subtle ? 0.16 : 0.12 + wn * 0.5;
    const ang = Math.atan2(cur.dir[1], cur.dir[0]) + turb * amt;
    const sp = cur.speed * gust();
    return [Math.cos(ang) * sp, Math.sin(ang) * sp];
  }

  function frame() {
    if (!ctx) return;
    t++;
    cur.speed += (target.speed - cur.speed) * 0.012;
    cur.gust += (target.gust - cur.gust) * 0.012;
    cur.dir[0] += (target.dir[0] - cur.dir[0]) * 0.01;
    cur.dir[1] += (target.dir[1] - cur.dir[1]) * 0.01;
    const m = emode();
    if (m !== cmode) reseed();

    if (m === "wind") {
      // fading trails
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
    } else {
      // crisp shapes: clear each frame
      ctx.clearRect(0, 0, W, H);
    }

    if (m === "wind") {
      ctx.lineWidth = 1.1;
      for (const p of P as WindP[]) {
        const px = p.x,
          py = p.y,
          f = windFieldAt(p.x, p.y);
        p.x += f[0] * p.spd;
        p.y += f[1] * p.spd;
        p.life--;
        ctx.strokeStyle = "rgba(" + o.tint + "," + p.a + ")";
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        if (p.x > W + 6 || p.x < -26 || p.y < -8 || p.y > H * o.sky + 8 || p.life <= 0)
          Object.assign(p, windP(), {
            x: cur.dir[0] >= 0 ? -rnd(0, 18) : W + rnd(0, 18),
            y: rnd(0, H * o.sky),
          });
      }
    } else if (m === "rain") {
      ctx.lineWidth = 1.05;
      const slant = cur.dir[0] * 3.0;
      for (const p of P as RainP[]) {
        p.x += slant;
        p.y += p.spd;
        const vl = Math.hypot(slant, p.spd) || 1,
          dx = (slant / vl) * p.len,
          dy = (p.spd / vl) * p.len;
        ctx.strokeStyle = "rgba(176,196,214," + p.a + ")";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - dx, p.y - dy);
        ctx.stroke();
        if (p.y > H + 4) {
          p.y = -rnd(4, H * 0.4);
          p.x = rnd(-40, W + 40);
        }
      }
    } else if (m === "snow") {
      for (const p of P as SnowP[]) {
        p.ph += 0.02;
        p.x += Math.sin(p.ph) * p.sw + cur.dir[0] * cur.speed * 0.6;
        p.y += p.spd;
        ctx.fillStyle = "rgba(248,248,250," + p.a + ")";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.283);
        ctx.fill();
        if (p.y > H + 4) {
          p.y = -4;
          p.x = rnd(0, W);
        }
        if (p.x < -6) p.x = W + 6;
        if (p.x > W + 6) p.x = -6;
      }
    } else {
      // fog
      for (const p of P as FogP[]) {
        p.x += p.dx;
        if (p.x > W + p.r) p.x = -p.r;
        if (p.x < -p.r) p.x = W + p.r;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, "rgba(228,226,219," + p.a + ")");
        g.addColorStop(1, "rgba(228,226,219,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.283);
        ctx.fill();
      }
    }
  }

  function loop() {
    frame();
    raf = requestAnimationFrame(loop);
  }
  return {
    startLoop() {
      if (!raf) {
        size();
        if (W > 0) raf = requestAnimationFrame(loop);
      }
    },
    // A single still frame for prefers-reduced-motion.
    renderOnce() {
      size();
      if (W === 0) return;
      cur.speed = target.speed;
      cur.gust = target.gust;
      cur.dir = [target.dir[0], target.dir[1]];
      frame();
    },
    stop() {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = null;
      }
      try {
        ctx?.clearRect(0, 0, cvs.width, cvs.height);
      } catch {
        // 0-sized while hidden — nothing to clear
      }
    },
    resize() {
      if (raf) size();
    },
  };
}

// Day-only gating shared by both canvas surfaces.
function isDay() {
  const root = document.documentElement;
  return root.getAttribute("data-time") === "day" && root.getAttribute("data-theme") !== "dark";
}

export function WeatherCanvas({ className, subtle = false }: { className: string; subtle?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const field = makeField(
      cvs,
      subtle
        ? { subtle: true, sky: 1.0, tint: "90,104,80", aMin: 0.04, aMax: 0.12 }
        : { sky: 0.66, tint: "251,247,238", aMin: 0.14, aMax: 0.55 },
    );
    const root = document.documentElement;
    const host = cvs.parentElement ?? cvs;
    let onScreen = true;

    const update = () => {
      if (!isDay() || document.hidden || !onScreen) {
        field.stop();
        return;
      }
      if (reduce) {
        field.renderOnce(); // still frame, no loop
        return;
      }
      field.startLoop();
    };

    update();
    const ro = new ResizeObserver(() => {
      field.resize();
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

    return () => {
      field.stop();
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [subtle]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

// ===========================================================================
// Weather controller — fetch + clouds (anime.js) + readout + sun/sky softening.
// Renders the cloud layer and the readout chip; drives the day sun/sky via CSS
// custom properties on <html> so it can soften the orb + mute the strata sky.
// ===========================================================================
const CLOUD_SVG =
  '<svg width="120" height="48" viewBox="0 0 120 48" fill="#FBF7EE" aria-hidden="true">' +
  '<ellipse cx="38" cy="30" rx="34" ry="16"/><ellipse cx="66" cy="24" rx="28" ry="18"/>' +
  '<ellipse cx="90" cy="31" rx="24" ry="14"/></svg>';
const REFRESH_MS = 10 * 60 * 1000;
const DEFAULT_WEATHER: Weather = {
  wind_speed_10m: 7,
  wind_gusts_10m: 12,
  wind_direction_10m: 295,
  cloud_cover: 25,
  weather_code: 1,
  temperature_2m: 62,
};

export function WeatherController({ readout = true }: { readout?: boolean }) {
  const cloudsRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);
  const readoutTextRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;
    let cancelled = false;
    let cloudAnims: { revert?: () => void; pause?: () => void }[] = [];
    let shown = false;
    let last: ReturnType<typeof applyWeather> | null = null;

    const clearClouds = () => {
      cloudAnims.forEach((a) => {
        try {
          a.pause?.();
          a.revert?.();
        } catch {
          /* ignore */
        }
      });
      cloudAnims = [];
      if (cloudsRef.current) cloudsRef.current.innerHTML = "";
    };
    const buildClouds = (n: number) => {
      clearClouds();
      const layer = cloudsRef.current;
      if (!layer) return;
      const right = cur.dir[0] >= 0;
      for (let i = 0; i < n; i++) {
        const c = document.createElement("div");
        c.className = "cloud";
        c.style.cssText = `top:${rnd(4, 42).toFixed(0)}%;opacity:${rnd(0.3, 0.55).toFixed(
          2,
        )};transform:scale(${rnd(0.55, 1.3).toFixed(2)})`;
        c.innerHTML = CLOUD_SVG;
        layer.appendChild(c);
        if (reduce) {
          c.style.left = rnd(5, 75).toFixed(0) + "%";
          continue;
        }
        const a = animate(c, {
          left: [right ? "-32%" : "118%", right ? "118%" : "-32%"],
          duration: rnd(46000, 92000),
          delay: rnd(0, 30000),
          ease: "linear",
          loop: true,
        });
        cloudAnims.push(a as unknown as { revert?: () => void; pause?: () => void });
      }
    };

    const applyVisuals = () => {
      const sunOpacity = target.mode === "fog" ? 0.12 : 1 - target.cloud * 0.8;
      const sunBlur = target.cloud * 3 + (target.mode === "fog" ? 3 : 0);
      root.style.setProperty("--wx-sun-opacity", sunOpacity.toFixed(2));
      root.style.setProperty("--wx-sun-blur", sunBlur.toFixed(1) + "px");
      root.style.setProperty("--wx-sky-sat", (1 - target.cloud * 0.3).toFixed(2));
      root.style.setProperty("--wx-sky-bright", (1 - target.cloud * 0.06).toFixed(2));
      buildClouds(target.mode === "fog" ? 0 : Math.round(target.cloud * 6));
    };
    const resetVisuals = () => {
      root.style.setProperty("--wx-sun-opacity", "1");
      root.style.setProperty("--wx-sun-blur", "0px");
      root.style.setProperty("--wx-sky-sat", "1");
      root.style.setProperty("--wx-sky-bright", "1");
      clearClouds();
    };

    const revealReadout = () => {
      if (!readout || shown || !isDay()) return;
      const el = readoutRef.current;
      if (!el) return;
      shown = true;
      if (reduce) {
        el.style.opacity = "1";
        return;
      }
      animate(el, { opacity: [0, 1], translateY: [6, 0], duration: 900, ease: "outCubic" });
    };

    const refreshScene = () => {
      if (cancelled || !last) return;
      // Weather visuals are day-only; at night reset so the moon/stars are clean.
      if (isDay()) applyVisuals();
      else resetVisuals();
      if (readout && readoutTextRef.current) {
        const r = last;
        readoutTextRef.current.textContent =
          `REDMOND, OR · ${codeLabel(r.code)} · ${compass(r.dir)} ${Math.round(r.spd)} mph` +
          (r.gst > r.spd + 3 ? ` · gusts ${Math.round(r.gst)}` : "") +
          ` · ${Math.round(r.temp)}°`;
        revealReadout();
      }
    };

    const fetchWeather = async () => {
      try {
        const res = await fetch("/api/weather", { cache: "no-store" });
        if (!res.ok) throw new Error("weather " + res.status);
        last = applyWeather((await res.json()) as Weather);
      } catch {
        last = applyWeather(DEFAULT_WEATHER); // calm default — never error visibly
      }
      refreshScene();
    };

    fetchWeather();
    const poll = window.setInterval(fetchWeather, REFRESH_MS);
    const mo = new MutationObserver(refreshScene);
    mo.observe(root, { attributes: true, attributeFilter: ["data-time", "data-theme"] });
    const onVis = () => {
      if (!document.hidden) refreshScene();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      clearInterval(poll);
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      clearClouds();
      resetVisuals();
    };
  }, [readout]);

  return (
    <>
      <div className="wx-clouds" ref={cloudsRef} aria-hidden="true" />
      {readout && (
        <div className="wx-readout" ref={readoutRef} aria-hidden="true">
          <span className="live" />
          <span ref={readoutTextRef}>monitoring…</span>
        </div>
      )}
    </>
  );
}

// ===========================================================================
// Night sky — static twinkle dots + a randomized meteor shower (Web Animations).
// Unchanged behavior: dark/night only, never scheduled under reduced motion.
// ===========================================================================
export function StarLayer({
  className,
  count,
  meteor = false,
  meteorMin = 650,
  meteorMax = 3200,
  doubleChance = 0,
}: {
  className: string;
  count: number;
  meteor?: boolean;
  meteorMin?: number;
  meteorMax?: number;
  doubleChance?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.querySelectorAll(".dot").forEach((d) => d.remove());
    let html = "";
    for (let i = 0; i < count; i++) {
      const s = rnd(1, 2.6).toFixed(1);
      html += `<span class="dot" style="width:${s}px;height:${s}px;top:${(
        Math.random() * 72
      ).toFixed(1)}%;left:${(Math.random() * 100).toFixed(1)}%;animation-delay:${rnd(0, 4).toFixed(
        1,
      )}s"></span>`;
    }
    host.insertAdjacentHTML("beforeend", html);
    return () => {
      host.querySelectorAll(".dot").forEach((d) => d.remove());
    };
  }, [count]);

  useEffect(() => {
    if (!meteor) return;
    const host = ref.current;
    if (!host) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const root = document.documentElement;
    let timer: number | null = null;
    let alive = true;

    const fire = () => {
      const r = host.getBoundingClientRect();
      if (r.width === 0) return;
      const big = Math.random() < 0.16;
      const len = big ? rnd(120, 190) : rnd(38, 110);
      const thick = big ? rnd(1.8, 2.6) : rnd(0.8, 1.8);
      const dur = rnd(820, 2500) * (big ? 1.25 : 1);
      const ang = rnd(12, 26);
      const bright = big ? rnd(0.8, 1) : rnd(0.3, 0.8);
      const dist = rnd(120, 250) + len * 0.4;
      const x = rnd(-len * 0.3, r.width * 0.72),
        y = rnd(0, r.height * 0.42);
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
      if (root.getAttribute("data-theme") === "dark") {
        fire();
        if (doubleChance > 0 && Math.random() < doubleChance) fire();
      }
      timer = window.setTimeout(tick, rnd(meteorMin, meteorMax));
    };
    timer = window.setTimeout(tick, rnd(400, 1400));

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      host.querySelectorAll(".meteor").forEach((m) => m.remove());
    };
  }, [meteor, meteorMin, meteorMax, doubleChance]);

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
