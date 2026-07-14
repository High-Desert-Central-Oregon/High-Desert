import Link from "next/link";
import { MarkerChip } from "./chips";
import { RustChevron } from "./section-row";

/**
 * Post-row vocabulary — the bundle's Exchange feed row (inner.html :562-580,
 * mkRow :1808-1815; spec §1.2): 44px sage monogram disc, marker kicker
 * (category square + label, then quiet "·" segments — neighborhood truncates,
 * the timestamp never does), Besley 24px ROMAN INK title (rows are ink;
 * pinned/detail titles are juniper), then the attribution line — author name,
 * the juniper verified check (every author is verified), and the rust chevron
 * pushed right. Whole row links; press ground is bone.
 */

/** Monogram disc — the bundle's sage circle (:1653; 44 rows / 48 detail). */
export function Monogram({
  initials,
  size = 44,
}: {
  initials: string;
  size?: 32 | 44 | 48;
}) {
  const fontSize = size === 48 ? 15 : size === 32 ? 11 : 13;
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full bg-secondary font-mono font-semibold text-foreground"
      style={{ width: size, height: size, fontSize }}
    >
      {initials}
    </span>
  );
}

/** Initials for the monogram: first letters of the first two words. */
export function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function VerifiedCheck() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#36563D"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function PostRow({
  href,
  markerLabel,
  markerColor,
  hood,
  when,
  title,
  sub,
  authorName,
  verifiedLabel,
}: {
  href: string;
  /** Category chip: colored square + mono label (never color alone). */
  markerLabel: string;
  markerColor: string;
  /** Quiet segment that truncates first (the bundle's HOOD slot). */
  hood: string;
  /** Quiet segment that NEVER truncates (§1.2: the timestamp is pinned). */
  when: string;
  title: string;
  /** Optional quiet line under the title (e.g. an event's location). */
  sub?: string;
  authorName: string;
  /** Accessible name for the verified check (every author is verified). */
  verifiedLabel: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[64px] items-start gap-[14px] border-b py-[var(--row-rhythm)] transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
    >
      <Monogram initials={initialsFor(authorName)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-x-[7px]">
          <MarkerChip label={markerLabel} color={markerColor} size={9} />
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            · {hood}
          </span>
          <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            · {when}
          </span>
        </div>
        <p className="mt-[9px] font-serif text-[24px] font-semibold leading-[1.22] text-foreground">
          {title}
        </p>
        {sub && (
          <p className="mt-[3px] text-[12.5px] leading-[1.45] text-muted-foreground">
            {sub}
          </p>
        )}
        <div className="mt-[10px] flex items-center gap-[6px]">
          <span className="min-w-0 truncate font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {authorName}
          </span>
          <span role="img" aria-label={verifiedLabel}>
            <VerifiedCheck />
          </span>
          <span className="ml-auto">
            <RustChevron />
          </span>
        </div>
      </div>
    </Link>
  );
}
