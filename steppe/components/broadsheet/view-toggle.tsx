import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n";

/**
 * Agenda | Month view toggle (calendar-c1-spec §1.2) — the segmented-control
 * grammar (bundle segStyle :1901: active = ink + 2px rust underline) stepped
 * to the 10px kicker scale, so it reads as an instrument subordinate to a
 * real segment bar (Board|Upcoming). State is the URL (?v=month; agenda is
 * the paramless default — agenda-first law): server-rendered links,
 * JS-optional, shareable, zero client storage.
 */
export function ViewToggle({
  active,
  agendaHref,
  monthHref,
  dict,
  className,
}: {
  active: "agenda" | "month";
  agendaHref: string;
  monthHref: string;
  dict: Dictionary;
  className?: string;
}) {
  const seg = (key: "agenda" | "month", href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={cn(
        "border-b-2 pb-[3px] font-mono text-[10px] font-semibold uppercase tracking-[0.1em] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        active === key
          ? "border-accent text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className={cn("flex items-center justify-end gap-4", className)}>
      {seg("agenda", agendaHref, dict.calendar.segAgenda)}
      {seg("month", monthHref, dict.calendar.segMonth)}
    </div>
  );
}
