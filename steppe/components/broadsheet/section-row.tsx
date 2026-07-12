import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Section-row vocabulary — the bundle's hairline list row (inner.html
 * :562-580 + the govern rows): mono kicker line, Besley title, quiet sub, and
 * a rust chevron (row affordance) or a chip on the right. Rows press bone.
 * SectionLabel is the mono .18em section head that groups rows (govOpenHead).
 */

export function RustChevron({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#A8542C"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="pb-1 pt-4 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </h2>
  );
}

export function SectionRow({
  href,
  kicker,
  title,
  sub,
  right,
  titleClassName,
}: {
  href?: string;
  kicker?: string;
  title: string;
  sub?: string;
  /** Right slot: omit for a rust chevron on linked rows; pass a chip/control otherwise. */
  right?: React.ReactNode;
  titleClassName?: string;
}) {
  const body = (
    <>
      <div className="min-w-0 flex-1">
        {kicker && (
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {kicker}
          </p>
        )}
        <p
          className={cn(
            "mt-1 font-serif text-[19px] font-semibold leading-[1.2] text-foreground",
            titleClassName,
          )}
        >
          {title}
        </p>
        {sub && (
          <p className="mt-[3px] text-[12.5px] leading-[1.45] text-muted-foreground">
            {sub}
          </p>
        )}
      </div>
      {right !== undefined ? right : href ? <RustChevron /> : null}
    </>
  );

  const rowClass =
    "flex items-center gap-3 border-b py-[18px] text-left";

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          rowClass,
          "transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
        )}
      >
        {body}
      </Link>
    );
  }
  return <div className={rowClass}>{body}</div>;
}
