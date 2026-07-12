/**
 * Horizon band — the bundle's 48px strata strip (inner.html :427-439): bone
 * ground, the rust sun with its soft halo + corona, then the sage-deep and
 * basalt ridgelines. Pure decoration (aria-hidden); it sits at the very top of
 * the member shell. SVG geometry is verbatim from the bundle; preserveAspectRatio
 * "none" stretches the ridges to any width like the original.
 */
export function HorizonBand() {
  return (
    <div aria-hidden="true" className="h-12 w-full overflow-hidden">
      <svg
        width="100%"
        height="48"
        viewBox="0 0 402 48"
        preserveAspectRatio="none"
        className="block h-12 w-full"
      >
        <rect width="402" height="48" fill="#EDE6D5" />
        <circle cx="246" cy="22" r="22" fill="#A8542C" opacity="0.09" />
        <circle cx="246" cy="22" r="16" fill="#A8542C" opacity="0.16" />
        <circle cx="246" cy="22" r="12.5" fill="#A8542C" />
        <circle cx="246" cy="22" r="15.5" fill="none" stroke="#A8542C" strokeWidth="0.75" opacity="0.4" />
        <path d="M0,30 C80,22 150,28 220,24 C300,19 350,26 402,22 L402,48 L0,48 Z" fill="#6E8A5B" />
        <path d="M0,40 C90,34 150,37 230,35 C320,32 372,36 402,35 L402,48 L0,48 Z" fill="#34383D" />
      </svg>
    </div>
  );
}
