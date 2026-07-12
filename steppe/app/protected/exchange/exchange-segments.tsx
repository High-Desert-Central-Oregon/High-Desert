import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n";

/**
 * The Exchange's segment bar — Board | Upcoming (spec §7.1): the calendar is
 * a VIEW within the Exchange, never a new tab. Same segment grammar as
 * Govern's (bundle segStyle :1901): uppercase mono, active = ink + 2px rust
 * underline.
 */
export function ExchangeSegments({
  active,
  dict,
}: {
  active: "board" | "upcoming";
  dict: Dictionary;
}) {
  const seg = (key: "board" | "upcoming", href: string, label: string) => (
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
      {seg("board", "/protected/exchange", dict.exchange.segBoard)}
      {seg("upcoming", "/protected/exchange/upcoming", dict.exchange.segUpcoming)}
    </div>
  );
}
