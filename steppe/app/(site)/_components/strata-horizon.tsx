// The layered-ground horizon with a time-of-day sky, from the canonical design
// (_design-source for the hero; steppe-partners-v2.html for the compact interior
// band). The sky gradient is driven by data-theme / data-time on <html> via the
// strata CSS in site-base.css. The HERO variant is now sky + hills only: the
// sun/moon, stars + shooting stars, and the live weather (wind/rain/snow/fog) are
// non-distorted overlays layered above it (SunOrb / StarLayer / WeatherCanvas /
// WeatherController in hero-sky.tsx + page.tsx), so the stretch-to-fill SVG never
// squashes the celestial bodies and weather can pass behind the sun. Interior
// pages still use the compact band (with its own in-SVG sun/moon).
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
        </defs>
        <rect className="sky-layer sky-dawn" x="0" y="0" width="1440" height="300" fill="url(#skyDawn)" />
        <rect className="sky-layer sky-day" x="0" y="0" width="1440" height="300" fill="url(#skyDay)" />
        <rect className="sky-layer sky-dusk" x="0" y="0" width="1440" height="300" fill="url(#skyDusk)" />
        <rect className="sky-layer sky-night" x="0" y="0" width="1440" height="300" fill="url(#skyNight)" />

        {/* Sun/moon, stars + shooting stars, and the day wind are all non-distorted
            overlays (SunOrb / StarLayer / WeatherCanvas in page.tsx), layered above
            this stretch-to-fill SVG. Here: only the sky gradient + the hills. */}

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
