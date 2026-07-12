import Link from "next/link";
import { RustChevron } from "./section-row";

/**
 * Date-tile row — the bundle's group-Upcoming grammar (inner.html :879-894):
 * a 46px hairline tile (mono 8.5px RUST month over a Besley 19px day
 * numeral), 16px Besley title, mono 9px when-line, rust chevron. The agenda
 * unit for every calendar surface (Exchange Upcoming, group Upcoming).
 * Dates render in Redmond's timezone — the platform clock, never the
 * browser's.
 */
export function DateTileRow({
  href,
  iso,
  locale,
  title,
  when,
}: {
  href: string;
  /** The occurrence's start (timestamptz ISO). */
  iso: string;
  locale: string;
  title: string;
  /** Mono when-line (time · place). */
  when: string;
}) {
  const d = new Date(iso);
  const mon = new Intl.DateTimeFormat(locale, {
    timeZone: "America/Los_Angeles",
    month: "short",
  }).format(d);
  const day = new Intl.DateTimeFormat(locale, {
    timeZone: "America/Los_Angeles",
    day: "numeric",
  }).format(d);

  return (
    <Link
      href={href}
      className="flex items-center gap-[13px] border-b py-[14px] transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
    >
      <span className="w-[46px] shrink-0 border py-[6px] text-center">
        <span className="block font-mono text-[8.5px] font-semibold uppercase tracking-[0.1em] text-accent">
          {mon}
        </span>
        <span className="block font-serif text-[19px] font-semibold leading-none text-foreground">
          {day}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-serif text-[16px] font-semibold leading-[1.2] text-foreground">
          {title}
        </span>
        <span className="mt-1 block font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {when}
        </span>
      </span>
      <RustChevron size={14} />
    </Link>
  );
}
