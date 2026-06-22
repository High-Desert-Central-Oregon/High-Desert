"use client";

import { useEffect, useRef } from "react";
import "./generative-landscape.css";

/**
 * GenerativeLandscape — a single self-contained WebGL/GLSL hero scene, ported from
 * _design-source/steppe-landscape-v5.html. It draws the BASE scene only: sky
 * gradient, sun glow (day) / phased moon (night), three Cascade ridgelines + a
 * high-desert foreground, paper grain, vignette, horizon haze, and the night static
 * star field. Time-of-day palette comes from the global data-time on <html> (honoring
 * data-theme); the moon phase is the real current synodic phase.
 *
 * Layering contract (see the generative scene wrapper): the shader owns the SCENE,
 * the library layer owns the MOVING weather. So the prototype's in-shader cloud
 * sprites, rain streaks, snowfall and fog veil are REMOVED here — the canvas/anime
 * engine draws those on top — but the *mood response* to weather is kept:
 *   u_cloud / u_overcast → mute + desaturate the sky and soften the sun glow,
 *   u_wet                → darken/wet the foreground ground,
 *   u_snow               → whiten ground accumulation.
 * Fog is the library's job; the shader has no fog veil.
 *
 * Battery/perf: the render loop eases toward targets and PAUSES once settled; it
 * re-kicks on resize, weather/mood change, or a data-time/theme change. DPR is
 * capped at 2. The per-pixel hash is the precision-stable `hashf` (not sin-based),
 * so grain/stars/foreground speckle don't band at the far corner on mobile.
 *
 * Fallback: a static, theme-aware sky+ridgeline plate (CSS, in generative-landscape.css)
 * renders for SSR / first paint / no-WebGL / prefers-reduced-motion. The opaque canvas
 * fades in over it on first draw, so there's no layout shift and no black flash.
 */

export type GenerativeLandscapeProps = {
  /** Fixed curated "plate" seed per deployment (see the product note). */
  seed?: number;
  /** Mood uniforms (0..1), normally driven by live weather. Default calm/clear. */
  cloudCover?: number;
  overcast?: number;
  wet?: number;
  snow?: number;
  className?: string;
};

type Time = "dawn" | "day" | "golden" | "dusk" | "night";
type Palette = {
  skyTop: number[];
  skyHorizon: number[];
  sun: number[];
  sunPos: number[];
  haze: number[];
  m0: number[];
  m1: number[];
  m2: number[];
  fg: number[];
  grain: number;
  stars: number;
  hazeAmt: number;
};

const VERT = `
  attribute vec2 a_position;
  void main(){ gl_Position = vec4(a_position, 0.0, 1.0); }`;

// Fragment shader ported verbatim from steppe-landscape-v5.html, with the in-shader
// weather particles removed (clouds / rain streaks / snowfall / fog veil) and
// u_rain renamed u_wet — the kept uniforms drive the mood response only.
const FRAG = `
  precision highp float;
  uniform vec2  u_resolution;
  uniform float u_time;
  uniform float u_seed;
  uniform vec3  u_skyTop, u_skyHorizon, u_sun, u_haze, u_m0, u_m1, u_m2, u_fg;
  uniform vec2  u_sunPos;
  uniform float u_grain, u_stars, u_ridge, u_hazeAmt, u_motion;
  uniform float u_isMoon, u_moonPhase;
  uniform float u_cloud, u_overcast, u_wet, u_snow;

  const float TAU = 6.2831853;

  float hash11(float n){ return fract(sin(n)*43758.5453123); }
  float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }

  // precision-stable hash for per-pixel sampling (no large-argument sin;
  // magnitude bounded so it holds up in mediump on mobile, edges included)
  float hashf(vec2 p){
    p = mod(p, 2048.0);
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float vnoise(float x){
    float i = floor(x); float f = fract(x);
    float u = f*f*(3.0-2.0*f);
    return mix(hash11(i), hash11(i+1.0), u);
  }
  float fbm(float x){
    float v=0.0, a=0.5;
    for(int i=0;i<6;i++){ v+=a*vnoise(x); x*=2.0; a*=0.5; }
    return v;
  }
  float vnoise2(vec2 p){
    vec2 i=floor(p), f=fract(p);
    vec2 u=f*f*(3.0-2.0*f);
    float a=hash21(i), b=hash21(i+vec2(1.0,0.0)), c=hash21(i+vec2(0.0,1.0)), d=hash21(i+vec2(1.0,1.0));
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }
  float fbm2(vec2 p){
    float v=0.0, a=0.5;
    for(int i=0;i<4;i++){ v+=a*vnoise2(p); p*=2.0; a*=0.5; }
    return v;
  }
  float ridge(float x, float freq, float seed, float base, float amp){
    float drift = u_motion * u_time * 0.004;
    float h = fbm((x + drift)*freq + seed);
    return base + (h - 0.5)*amp;
  }

  void main(){
    vec2 frag = gl_FragCoord.xy;
    vec2 uv = frag / u_resolution.xy;
    float aspect = u_resolution.x / max(u_resolution.y, 1.0);
    float Lsky = dot(mix(u_skyHorizon, u_skyTop, 0.5), vec3(0.299,0.587,0.114));

    // sky
    float ty = smoothstep(0.0, 1.0, uv.y);
    vec3 col = mix(u_skyHorizon, u_skyTop, ty);

    // overcast: flatten + desaturate (palette-driven so night stays dark)
    vec3 ocTop = mix(u_skyTop, vec3(dot(u_skyTop, vec3(0.299,0.587,0.114))), 0.7) * 1.05;
    vec3 ocHor = mix(u_skyHorizon, vec3(dot(u_skyHorizon, vec3(0.299,0.587,0.114))), 0.7) * 0.95;
    col = mix(col, mix(ocHor, ocTop, ty), u_overcast);

    vec2 sunVec = (uv - u_sunPos) * vec2(aspect, 1.0);
    float sunDist = length(sunVec);
    // cloud cover + overcast soften the sky/sun glow (the libraries draw the cloud
    // forms on top, so an overcast day still darkens here)
    float skyAtten = (1.0 - u_overcast*0.85) * (1.0 - u_cloud*0.35);

    // stars (static field)
    if(u_stars > 0.5){
      vec2 g = floor(frag/2.5);
      float s = hashf(g);
      col += vec3(step(0.9975, s) * smoothstep(0.4, 1.0, uv.y)) * skyAtten;
    }

    // glow (scaled by moon illumination + sky attenuation)
    float frac = (1.0 - cos(TAU*u_moonPhase)) * 0.5;
    float glowAmt = mix(1.0, frac, u_isMoon) * skyAtten;
    col += u_sun * exp(-sunDist*7.0) * 0.85 * glowAmt;
    col += u_sun * exp(-sunDist*2.2) * 0.16 * glowAmt;

    // sun / moon disc with phase
    float R = 0.05;
    vec2 md = sunVec / R;
    float sd = length(md);
    float edge = smoothstep(1.0, 0.90, sd) * skyAtten;
    float xl = sqrt(max(0.0, 1.0 - md.y*md.y));
    float cph = cos(TAU*u_moonPhase);
    float tsd = (u_moonPhase < 0.5) ? (md.x - cph*xl) : (-md.x - cph*xl);
    float litMask = mix(1.0, smoothstep(-0.05, 0.05, tsd), u_isMoon);
    // moon surface: limb darkening + soft maria + fine craters
    float ld = sqrt(max(0.0, 1.0 - sd*sd));
    float limb = mix(0.74, 1.0, ld);
    float seas = fbm2(md*1.7 + 12.0);
    float maria = 1.0 - smoothstep(0.52, 0.74, seas)*0.18;
    vec2 cg = md*9.0;
    vec2 cfr = fract(cg) - 0.5;
    float crater = 0.0;
    if(hash21(floor(cg)) > 0.86){
      float rr = length(cfr);
      crater = -smoothstep(0.30, 0.08, rr)*0.12 + smoothstep(0.44, 0.34, rr)*0.05;
    }
    float surf = clamp(mix(1.0, limb*maria + crater, u_isMoon), 0.0, 1.3);
    vec3 discDark = u_sun*0.10;
    vec3 discCol = mix(discDark, u_sun*1.04*surf, litMask);
    col = mix(col, discCol, edge);

    // mountains
    float aa = 1.6 / u_resolution.y;
    float r0 = ridge(uv.x, 1.4*u_ridge, u_seed + 11.0, 0.62, 0.16);
    float in0 = 1.0 - smoothstep(r0 - aa, r0 + aa, uv.y);
    vec3 c0 = u_m0;
    float snowcap = smoothstep(r0 - 0.10, r0 - 0.004, uv.y) * smoothstep(0.60, 0.78, r0);
    c0 = mix(c0, vec3(0.93,0.94,0.97), snowcap*0.6);
    col = mix(col, c0, in0);

    float r1 = ridge(uv.x, 2.3*u_ridge, u_seed + 27.0, 0.46, 0.18);
    float in1 = 1.0 - smoothstep(r1 - aa, r1 + aa, uv.y);
    col = mix(col, u_m1, in1);

    float r2 = ridge(uv.x, 3.6*u_ridge, u_seed + 43.0, 0.32, 0.16);
    float in2 = 1.0 - smoothstep(r2 - aa, r2 + aa, uv.y);
    col = mix(col, u_m2, in2);

    // foreground (wet darkens, snow whitens — the mood response; the moving
    // rain/snow particles are drawn by the library layer, not here)
    float fgLine = 0.20 + fbm(uv.x*5.0 + u_seed + 60.0)*0.03;
    float inFg = 1.0 - smoothstep(fgLine - aa, fgLine + aa, uv.y);
    vec3 fg = u_fg;
    fg *= mix(0.86, 1.06, smoothstep(0.0, fgLine, uv.y));
    float stip = hashf(floor(frag/3.0) + u_seed);
    float speck = step(0.94, stip) * inFg * smoothstep(fgLine, 0.0, uv.y);
    fg = mix(fg, fg*0.82, speck);
    fg *= 0.96 + 0.06*fbm(uv.x*12.0 + u_seed*2.0);
    fg = mix(fg, fg*0.72, u_wet*0.45);                  // wet ground
    fg = mix(fg, vec3(0.88,0.90,0.93), u_snow*0.55);    // snow accumulation
    col = mix(col, fg, inFg);

    // horizon haze
    float hz = smoothstep(0.20, 0.50, uv.y) * (1.0 - smoothstep(0.50, 0.82, uv.y));
    col = mix(col, u_haze, hz * u_hazeAmt * 0.45);

    // grain + vignette
    col += (hashf(frag) - 0.5) * u_grain;
    vec2 q = uv - 0.5;
    float vig = smoothstep(1.15, 0.35, length(q*vec2(aspect,1.0)));
    col *= mix(0.93, 1.0, vig);

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }`;

function hex(h: string): number[] {
  h = h.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

// Palettes ported verbatim from the v5 prototype (golden kept for completeness even
// though the app's ThemeController only sets dawn/day/dusk/night).
const PAL: Record<Time, Palette> = {
  dawn: { skyTop: hex("43507E"), skyHorizon: hex("E7B58E"), sun: hex("FFE7C9"), sunPos: [0.74, 0.28], haze: hex("D8C2B2"), m0: hex("97A0C0"), m1: hex("6E6E93"), m2: hex("534B5C"), fg: hex("46453F"), grain: 0.05, stars: 0, hazeAmt: 1.0 },
  day: { skyTop: hex("2E6FAE"), skyHorizon: hex("C3DBEA"), sun: hex("FFF8E6"), sunPos: [0.5, 0.84], haze: hex("CDDFEA"), m0: hex("9FB2C6"), m1: hex("6E8089"), m2: hex("56685A"), fg: hex("7C7B5B"), grain: 0.045, stars: 0, hazeAmt: 1.0 },
  golden: { skyTop: hex("6E84A6"), skyHorizon: hex("F6D49A"), sun: hex("FFE2A4"), sunPos: [0.3, 0.32], haze: hex("E7C79E"), m0: hex("B6A6A0"), m1: hex("8B7D83"), m2: hex("6C5F46"), fg: hex("897A4D"), grain: 0.05, stars: 0, hazeAmt: 1.05 },
  dusk: { skyTop: hex("282C54"), skyHorizon: hex("D2743E"), sun: hex("FF9A52"), sunPos: [0.68, 0.18], haze: hex("7C5057"), m0: hex("5A5A78"), m1: hex("43425E"), m2: hex("2E2C3E"), fg: hex("20202C"), grain: 0.05, stars: 0, hazeAmt: 1.1 },
  night: { skyTop: hex("0B1330"), skyHorizon: hex("233056"), sun: hex("C7CEDD"), sunPos: [0.66, 0.74], haze: hex("2A3556"), m0: hex("2C3556"), m1: hex("1F2742"), m2: hex("161B30"), fg: hex("0F1322"), grain: 0.04, stars: 1, hazeAmt: 0.8 },
};

function clonePal(p: Palette): Palette {
  return {
    skyTop: p.skyTop.slice(), skyHorizon: p.skyHorizon.slice(), sun: p.sun.slice(),
    sunPos: p.sunPos.slice(), haze: p.haze.slice(), m0: p.m0.slice(), m1: p.m1.slice(),
    m2: p.m2.slice(), fg: p.fg.slice(), grain: p.grain, stars: p.stars, hazeAmt: p.hazeAmt,
  };
}

// Real current moon phase (synodic), 0..1 — matches the v5 calc.
function moonPhase(d: Date): number {
  const syn = 29.530588853;
  const ref = Date.UTC(2000, 0, 6, 18, 14) / 86400000;
  let p = ((d.getTime() / 86400000 - ref) % syn) / syn;
  if (p < 0) p += 1;
  return p;
}

// Pick the palette key from <html> data-time, honoring a manual dark override
// (data-theme=dark) and falling back to day for anything unexpected.
function pickKey(root: HTMLElement): Time {
  const theme = root.getAttribute("data-theme");
  const time = root.getAttribute("data-time") as Time | null;
  if (theme === "dark" || time === "night") return "night";
  if (time === "dawn" || time === "day" || time === "golden" || time === "dusk") return time;
  return "day";
}

export function GenerativeLandscape({
  seed = 427,
  cloudCover = 0,
  overcast = 0,
  wet = 0,
  snow = 0,
  className,
}: GenerativeLandscapeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Latest mood, read by the persistent render loop without restarting it.
  const moodRef = useRef({ cloud: cloudCover, overcast, wet, snow, seed });
  moodRef.current = { cloud: cloudCover, overcast, wet, snow, seed };
  // The loop installs a "poke" here so prop-driven mood updates can wake a settled loop.
  const pokeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) return; // no WebGL → the static fallback stays visible

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const FADE = reduceMotion ? 1.0 : 0.085;
    const MORPH = reduceMotion ? 1.0 : 0.05;

    function compile(type: number, src: string) {
      const sh = gl!.createShader(type);
      if (!sh) return null;
      gl!.shaderSource(sh, src);
      gl!.compileShader(sh);
      if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) {
        console.error(gl!.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    }
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return; // compile failure → keep the fallback
    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aLoc = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(aLoc);
    gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

    const U: Record<string, WebGLUniformLocation | null> = {};
    [
      "u_resolution", "u_time", "u_seed", "u_skyTop", "u_skyHorizon", "u_sun", "u_haze",
      "u_m0", "u_m1", "u_m2", "u_fg", "u_sunPos", "u_grain", "u_stars", "u_ridge",
      "u_hazeAmt", "u_motion", "u_isMoon", "u_moonPhase", "u_cloud", "u_overcast",
      "u_wet", "u_snow",
    ].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));

    const root = document.documentElement;
    let key = pickKey(root);
    const cur = clonePal(PAL[key]);
    let tgt = PAL[key];
    const curW = { cloud: moodRef.current.cloud, overcast: moodRef.current.overcast, wet: moodRef.current.wet, snow: moodRef.current.snow };
    let curSeed = moodRef.current.seed;
    let isMoonCur = key === "night" ? 1 : 0;
    let isMoonTgt = isMoonCur;
    const phase = moonPhase(new Date());
    const startT = performance.now();
    let raf: number | null = null;
    let running = false;
    let live = false;
    let onScreen = true;

    function lerpArr(a: number[], b: number[], f: number) {
      let m = 0;
      for (let i = 0; i < a.length; i++) {
        const d = b[i] - a[i];
        a[i] += d * f;
        m = Math.max(m, Math.abs(d));
      }
      return m;
    }
    const lerpNum = (a: number, b: number, f: number) => a + (b - a) * f;

    function draw() {
      if (!gl) return;
      const t = (performance.now() - startT) / 1000;
      gl.uniform2f(U.u_resolution, canvas!.width, canvas!.height);
      gl.uniform1f(U.u_time, t);
      gl.uniform1f(U.u_seed, curSeed);
      gl.uniform3fv(U.u_skyTop, cur.skyTop);
      gl.uniform3fv(U.u_skyHorizon, cur.skyHorizon);
      gl.uniform3fv(U.u_sun, cur.sun);
      gl.uniform3fv(U.u_haze, cur.haze);
      gl.uniform3fv(U.u_m0, cur.m0);
      gl.uniform3fv(U.u_m1, cur.m1);
      gl.uniform3fv(U.u_m2, cur.m2);
      gl.uniform3fv(U.u_fg, cur.fg);
      gl.uniform2fv(U.u_sunPos, cur.sunPos);
      gl.uniform1f(U.u_grain, cur.grain);
      gl.uniform1f(U.u_stars, cur.stars);
      gl.uniform1f(U.u_ridge, 1.0);
      gl.uniform1f(U.u_hazeAmt, cur.hazeAmt);
      gl.uniform1f(U.u_motion, 0.0); // static base; the moving weather is the library layer
      gl.uniform1f(U.u_isMoon, isMoonCur);
      gl.uniform1f(U.u_moonPhase, phase);
      gl.uniform1f(U.u_cloud, curW.cloud);
      gl.uniform1f(U.u_overcast, curW.overcast);
      gl.uniform1f(U.u_wet, curW.wet);
      gl.uniform1f(U.u_snow, curW.snow);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!live) {
        live = true;
        canvas!.classList.add("is-live"); // fade the canvas in over the fallback
      }
    }

    function step() {
      let d = 0;
      d = Math.max(d, lerpArr(cur.skyTop, tgt.skyTop, FADE));
      d = Math.max(d, lerpArr(cur.skyHorizon, tgt.skyHorizon, FADE));
      d = Math.max(d, lerpArr(cur.sun, tgt.sun, FADE));
      d = Math.max(d, lerpArr(cur.sunPos, tgt.sunPos, FADE));
      d = Math.max(d, lerpArr(cur.haze, tgt.haze, FADE));
      d = Math.max(d, lerpArr(cur.m0, tgt.m0, FADE));
      d = Math.max(d, lerpArr(cur.m1, tgt.m1, FADE));
      d = Math.max(d, lerpArr(cur.m2, tgt.m2, FADE));
      d = Math.max(d, lerpArr(cur.fg, tgt.fg, FADE));
      cur.grain = lerpNum(cur.grain, tgt.grain, FADE);
      cur.hazeAmt = lerpNum(cur.hazeAmt, tgt.hazeAmt, FADE);
      cur.stars = lerpNum(cur.stars, tgt.stars, FADE);

      const m = moodRef.current;
      let dW = 0;
      (["cloud", "overcast", "wet", "snow"] as const).forEach((k) => {
        const before = curW[k];
        curW[k] = lerpNum(curW[k], m[k], FADE);
        dW = Math.max(dW, Math.abs(curW[k] - before));
      });
      const isMoonD = Math.abs(isMoonTgt - isMoonCur);
      isMoonCur = lerpNum(isMoonCur, isMoonTgt, FADE);
      const seedD = Math.abs(m.seed - curSeed);
      curSeed = lerpNum(curSeed, m.seed, MORPH);

      draw();

      // Pause when settled (battery). Re-kicked on resize / mood change / theme change.
      if (d > 0.0015 || dW > 0.0015 || isMoonD > 0.001 || seedD > 0.05) {
        raf = requestAnimationFrame(step);
      } else {
        running = false;
      }
    }
    function kick() {
      if (!running && onScreen && !document.hidden) {
        running = true;
        raf = requestAnimationFrame(step);
      }
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas!.clientWidth * dpr);
      const h = Math.round(canvas!.clientHeight * dpr);
      if (w === 0 || h === 0) return;
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
        gl!.viewport(0, 0, w, h);
      }
      kick();
    }

    // React to live weather/seed (props → moodRef) and theme/time changes.
    function syncTargets() {
      key = pickKey(root);
      tgt = PAL[key];
      isMoonTgt = key === "night" ? 1 : 0;
      kick();
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const mo = new MutationObserver(syncTargets);
    mo.observe(root, { attributes: true, attributeFilter: ["data-time", "data-theme"] });
    const io = new IntersectionObserver(
      (e) => {
        onScreen = e[0]?.isIntersecting ?? true;
        if (onScreen) kick();
        else if (raf) {
          cancelAnimationFrame(raf);
          raf = null;
          running = false;
        }
      },
      { threshold: 0 },
    );
    io.observe(canvas);
    const onVis = () => {
      if (!document.hidden) kick();
    };
    document.addEventListener("visibilitychange", onVis);

    // expose a poke for prop-driven mood updates
    const poke = () => kick();
    pokeRef.current = poke;

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      pokeRef.current = null;
      const lose = gl.getExtension("WEBGL_lose_context");
      lose?.loseContext();
      canvas.classList.remove("is-live");
    };
  }, []);

  // Whenever mood/seed props change, nudge the (possibly settled) loop awake.
  useEffect(() => {
    pokeRef.current?.();
  }, [cloudCover, overcast, wet, snow, seed]);

  return (
    <div className={`gl-stage${className ? ` ${className}` : ""}`}>
      {/* Static, theme-aware fallback (SSR / first paint / no-WebGL / reduced motion). */}
      <svg className="gl-fallback" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="glSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--gl-sky-top)" />
            <stop offset="1" stopColor="var(--gl-sky-horizon)" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="100" height="100" fill="url(#glSky)" />
        <path d="M0 52 Q25 42 50 50 T100 48 V100 H0Z" fill="var(--gl-m0)" />
        <path d="M0 64 Q30 56 60 62 T100 60 V100 H0Z" fill="var(--gl-m1)" />
        <path d="M0 76 Q35 70 70 74 T100 73 V100 H0Z" fill="var(--gl-m2)" />
        <rect x="0" y="82" width="100" height="18" fill="var(--gl-fg)" />
      </svg>
      <canvas ref={canvasRef} className="gl-canvas" aria-hidden="true" />
    </div>
  );
}
