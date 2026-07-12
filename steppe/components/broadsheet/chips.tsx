import { cn } from "@/lib/utils";

/**
 * Chip vocabulary — the bundle's status + category chips:
 *  - StatusChip quiet  = JOINED (:1930): hairline border, bone ground, ink-soft.
 *  - StatusChip primary = JOIN: juniper-deep fill, paper, letterpress.
 *  - MarkerChip (:1493): a colored 10px square (r-marker) ALWAYS beside its
 *    mono label — never color alone.
 * All type: Martian Mono, UPPERCASE, square corners.
 */

export function StatusChip({
  label,
  tone = "quiet",
  className,
}: {
  label: string;
  tone?: "quiet" | "primary";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-[14px] py-[9px] font-mono text-[10px] font-semibold uppercase tracking-[0.1em]",
        tone === "quiet"
          ? "border bg-muted text-muted-foreground"
          : "bg-primary text-primary-foreground shadow-letterpress",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function MarkerChip({
  label,
  color,
  className,
}: {
  label: string;
  /** A brand marker color (e.g. "var(--marker, #6E8A5B)") — squares are always labeled. */
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[7px] font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-block size-[10px] rounded-marker"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

/** Round icon slot — the bundle's 34px header action circle (:448). */
export function IconSlot({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-[34px] items-center justify-center rounded-full border bg-card",
        className,
      )}
    >
      {children}
    </span>
  );
}
