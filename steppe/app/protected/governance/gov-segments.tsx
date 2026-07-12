import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n";

/**
 * Govern's pinned segment bar (preview-nav-spec §4: Transparency lives INSIDE
 * Govern as "the Record", not as a top-level destination). Styled as the
 * bundle's segment chips: uppercase mono, active = ink + 2px rust underline
 * (inner.html segStyle :1901).
 */
export function GovSegments({
  active,
  dict,
}: {
  active: "proposals" | "record";
  dict: Dictionary;
}) {
  const seg = (key: "proposals" | "record", href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={cn(
        "border-b-2 pb-1 font-mono text-[11.5px] font-semibold uppercase tracking-[0.1em] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        active === key
          ? "border-accent text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="flex items-center gap-5 border-b pb-0.5">
      {seg("proposals", "/protected/governance", dict.governance.segProposals)}
      {seg("record", "/protected/governance/record", dict.governance.segRecord)}
    </div>
  );
}
