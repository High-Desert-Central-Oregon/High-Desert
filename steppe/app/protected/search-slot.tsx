"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconSlot } from "@/components/broadsheet/chips";

/**
 * The shell header's round search slot — scope-aware (bundle: search belongs
 * to Exchange AND Groups, :1904-1917): on the Exchange it opens the board's
 * own search ("Search the Exchange", spec §1.4); everywhere else it opens the
 * groups directory search, as before. Both targets are the server-rendered
 * ?s=1 reveal — the link works without JavaScript; only the destination
 * choice needs the pathname.
 */
export function SearchSlot({ label }: { label: string }) {
  const pathname = usePathname();
  const href = pathname?.startsWith("/protected/exchange")
    ? "/protected/exchange?s=1"
    : "/protected/groups?s=1";

  return (
    <Link
      href={href}
      aria-label={label}
      className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <IconSlot>
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2A2E2C"
          strokeWidth="1.9"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-3.6-3.6" />
        </svg>
      </IconSlot>
    </Link>
  );
}
