// The layered-ground horizon with a time-of-day sky + sun/moon, lifted from the
// canonical design (_design-source/steppe-landing-v5.html for the hero;
// steppe-partners-v2.html for the compact interior band). Pure SVG — every
// transition is driven by the data-theme / data-time attributes on <html> and the
// strata CSS in site-base.css; no client JS. The hero variant carries the desktop
// night shooting-stars; interior pages use the compact band. Day wind is the
// Canvas particle field (hero-sky.tsx), and on the short MOBILE hero band the
// sun/moon and stars are non-distorted overlays (see page.tsx / landing.css) — the
// in-SVG sun-group/night-group are hidden there so the stretch-to-fill SVG can't
// squash the celestial bodies.
export function StrataHorizon({
  variant = "compact",
}: {
  variant?: "hero" | "compact";
}) {
  if (variant === "hero") {
    return (
      <svg
        className="strata"
        viewBox="0 0 1440 300"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="skyDawn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F0CBB6" />
            <stop offset=".55" stopColor="#EBD8C4" />
            <stop offset="1" stopColor="#EDE6D5" />
          </linearGradient>
          <linearGradient id="skyDay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#D7E3E0" />
            <stop offset=".6" stopColor="#E4E4D7" />
            <stop offset="1" stopColor="#EDE6D5" />
          </linearGradient>
          <linearGradient id="skyDusk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E7B98A" />
            <stop offset=".5" stopColor="#E2B79A" />
            <stop offset="1" stopColor="#EDE6D5" />
          </linearGradient>
          <linearGradient id="skyNight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#161B26" />
            <stop offset=".6" stopColor="#1E2430" />
            <stop offset="1" stopColor="#22262B" />
          </linearGradient>
          <linearGradient id="trail" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#EDE6D5" stopOpacity="0" />
            <stop offset=".7" stopColor="#EDE6D5" stopOpacity=".5" />
            <stop offset="1" stopColor="#FFFDF7" stopOpacity="1" />
          </linearGradient>
        </defs>
        <rect className="sky-layer sky-dawn" x="0" y="0" width="1440" height="300" fill="url(#skyDawn)" />
        <rect className="sky-layer sky-day" x="0" y="0" width="1440" height="300" fill="url(#skyDay)" />
        <rect className="sky-layer sky-dusk" x="0" y="0" width="1440" height="300" fill="url(#skyDusk)" />
        <rect className="sky-layer sky-night" x="0" y="0" width="1440" height="300" fill="url(#skyNight)" />

        {/* Day wind is the Canvas particle field (WindCanvas), not drawn marks. */}

        <g className="night-group">
          <circle className="twinkle" cx="220" cy="70" r="1.6" fill="#EDE6D5" />
          <circle className="twinkle b" cx="430" cy="50" r="1.3" fill="#EDE6D5" />
          <circle className="twinkle c" cx="640" cy="92" r="1.7" fill="#EDE6D5" />
          <circle className="twinkle b" cx="880" cy="58" r="1.3" fill="#EDE6D5" />
          <circle className="twinkle" cx="300" cy="120" r="1.2" fill="#EDE6D5" />
          <circle className="twinkle c" cx="540" cy="140" r="1.4" fill="#EDE6D5" />
          <circle className="twinkle" cx="1000" cy="110" r="1.5" fill="#EDE6D5" />
          <circle className="twinkle b" cx="1260" cy="74" r="1.4" fill="#EDE6D5" />
          <g transform="translate(1130,80)">
            <circle r="38" fill="#E9E3D4" />
            <circle r="38" cx="15" cy="-9" fill="#1E2430" />
          </g>
          <g transform="translate(250,40)">
            <g className="shoot s1">
              <line x1="-40" y1="-15" x2="0" y2="0" stroke="url(#trail)" strokeWidth="2.2" strokeLinecap="round" />
              <circle r="1.9" fill="#FFFDF7" />
            </g>
          </g>
          <g transform="translate(820,28)">
            <g className="shoot s2">
              <line x1="-26" y1="-12" x2="0" y2="0" stroke="url(#trail)" strokeWidth="2" strokeLinecap="round" />
              <circle r="1.7" fill="#FFFDF7" />
            </g>
          </g>
          <g transform="translate(520,84)">
            <g className="shoot s3">
              <line x1="-34" y1="-10" x2="0" y2="0" stroke="url(#trail)" strokeWidth="1.8" strokeLinecap="round" />
              <circle r="1.6" fill="#FFFDF7" />
            </g>
          </g>
          <g transform="translate(1080,52)">
            <g className="shoot s4">
              <line x1="-44" y1="-18" x2="0" y2="0" stroke="url(#trail)" strokeWidth="2.2" strokeLinecap="round" />
              <circle r="1.9" fill="#FFFDF7" />
            </g>
          </g>
          <g transform="translate(160,96)">
            <g className="shoot s5">
              <line x1="-22" y1="-9" x2="0" y2="0" stroke="url(#trail)" strokeWidth="1.6" strokeLinecap="round" />
              <circle r="1.4" fill="#FFFDF7" />
            </g>
          </g>
        </g>

        <g className="sun-group">
          <circle className="sun-halo sun-breathe" cx="1130" cy="82" r="88" opacity=".34" />
          <circle className="sun" cx="1130" cy="82" r="52" />
        </g>

        <path d="M0 168 Q240 132 480 156 T960 150 T1440 160 V300 H0Z" fill="#9CAD8B" />
        <path d="M0 206 Q300 182 600 198 T1200 192 T1440 200 V300 H0Z" fill="#36563D" />
        <path d="M0 244 Q360 228 720 240 T1440 238 V300 H0Z" fill="#34383D" />
      </svg>
    );
  }

  return (
    <svg
      className="strata"
      viewBox="0 0 1440 150"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="skyDawn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F0CBB6" />
          <stop offset="1" stopColor="#EDE6D5" />
        </linearGradient>
        <linearGradient id="skyDay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D7E3E0" />
          <stop offset="1" stopColor="#EDE6D5" />
        </linearGradient>
        <linearGradient id="skyDusk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E7B98A" />
          <stop offset="1" stopColor="#EDE6D5" />
        </linearGradient>
        <linearGradient id="skyNight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#161B26" />
          <stop offset="1" stopColor="#22262B" />
        </linearGradient>
      </defs>
      <rect className="sky-l sky-dawn" width="1440" height="150" fill="url(#skyDawn)" />
      <rect className="sky-l sky-day" width="1440" height="150" fill="url(#skyDay)" />
      <rect className="sky-l sky-dusk" width="1440" height="150" fill="url(#skyDusk)" />
      <rect className="sky-l sky-night" width="1440" height="150" fill="url(#skyNight)" />
      <g className="night-g">
        <circle cx="300" cy="40" r="1.4" fill="#EDE6D5" />
        <circle cx="680" cy="30" r="1.5" fill="#EDE6D5" />
        <circle cx="1020" cy="46" r="1.3" fill="#EDE6D5" />
        <g transform="translate(1140,48)">
          <circle r="26" fill="#E9E3D4" />
          <circle r="26" cx="11" cy="-6" fill="#1E2430" />
        </g>
      </g>
      <g className="sun-g">
        <circle className="breathe" cx="1140" cy="50" r="58" fill="#D98C56" opacity=".34" />
        <circle className="sun-d" cx="1140" cy="50" r="34" />
      </g>
      <path d="M0 84 Q360 60 720 76 T1440 78 V150 H0Z" fill="#9CAD8B" />
      <path d="M0 110 Q420 92 840 104 T1440 104 V150 H0Z" fill="#36563D" />
      <path d="M0 132 Q480 120 960 130 T1440 128 V150 H0Z" fill="#34383D" />
    </svg>
  );
}
