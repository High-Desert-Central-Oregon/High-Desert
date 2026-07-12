/**
 * Horizon band — the bundle's 48px strata strip (inner.html :427-439): bone
 * ground, the rust sun with its soft halo + corona, then the sage-deep and
 * basalt ridgelines. Pure decoration (aria-hidden); it sits at the very top of
 * the member shell.
 *
 * Desktop adaptation: the band is TWO layers so it can stretch without
 * distorting the sun. The ridgelines keep the bundle's verbatim geometry and
 * stretch to any width (preserveAspectRatio "none", like the original); the
 * sun is its own square-viewBox layer, horizontally centered and scaled
 * uniformly with the band height — a circle at every width, never an ellipse,
 * never clipped (the r=22 halo tops out at y=0 inside its 48-unit box). Band
 * height scales with the viewport: 48px through phone/tablet, up to 72px on
 * wide screens, with the sun/ridge composition held proportional.
 */
export function HorizonBand() {
  return (
    <div
      aria-hidden="true"
      className="relative h-[clamp(3rem,6vw,4.5rem)] w-full overflow-hidden bg-[#EDE6D5]"
    >
      {/* Sun layer — uniform scale, centered; paints behind the ridges. */}
      <svg
        viewBox="0 0 48 48"
        className="absolute left-1/2 top-0 h-full w-auto -translate-x-1/2"
        style={{ aspectRatio: "1" }}
      >
        <circle cx="24" cy="22" r="22" fill="#A8542C" opacity="0.09" />
        <circle cx="24" cy="22" r="16" fill="#A8542C" opacity="0.16" />
        <circle cx="24" cy="22" r="12.5" fill="#A8542C" />
        <circle cx="24" cy="22" r="15.5" fill="none" stroke="#A8542C" strokeWidth="0.75" opacity="0.4" />
      </svg>
      {/* Ridgelines — verbatim bundle geometry, stretched like the original. */}
      <svg
        viewBox="0 0 402 48"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <path d="M0,30 C80,22 150,28 220,24 C300,19 350,26 402,22 L402,48 L0,48 Z" fill="#6E8A5B" />
        <path d="M0,40 C90,34 150,37 230,35 C320,32 372,36 402,35 L402,48 L0,48 Z" fill="#34383D" />
      </svg>
    </div>
  );
}
