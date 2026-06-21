// The Steppe monogram seal — a bone disc holding the layered high-desert scene
// (basalt/juniper strata, sage ridge, rust sun). Lifted from the canonical design
// (_design-source/steppe-landing-v5.html). Used at small sizes in the nav and
// footer. `clipId` must be unique per instance on a page, since the clipPath is
// referenced by id (two seals with the same id would collide).
export function SealMark({
  size = 30,
  clipId,
}: {
  size?: number;
  clipId: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="18.5" fill="#FBF7EE" stroke="#36563D" strokeWidth="1.5" />
      <clipPath id={clipId}>
        <circle cx="20" cy="20" r="15" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <rect x="5" y="22" width="30" height="14" fill="#34383D" />
        <rect x="5" y="18" width="30" height="5" fill="#36563D" />
        <path d="M5 18 Q14 13 22 17 T35 16 V23 H5Z" fill="#9CAD8B" />
        <circle cx="26" cy="16" r="4.6" fill="#A8542C" />
      </g>
    </svg>
  );
}
