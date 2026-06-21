"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SealMark } from "./seal-mark";
import { ThemeController } from "./theme-controller";

/**
 * Shared marketing nav (v5 design). Seal + "Steppe" wordmark home link, the
 * Preview / For partners links with active-route styling, the day/night theme
 * toggle, and a Join pill. Client component so usePathname can mark the active
 * route. On mobile the text links collapse (CSS) leaving the toggle + Join.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const active = (href: string) =>
    pathname === href ? "active" : undefined;

  return (
    <nav className="nav">
      <div className="nav-in">
        <Link className="brand" href="/">
          <SealMark clipId="seal-nav" />
          Steppe
        </Link>
        <div className="nav-right">
          <div className="nav-links">
            <Link href="/preview" className={active("/preview")}>
              Preview
            </Link>
            <Link href="/partners" className={active("/partners")}>
              For partners
            </Link>
          </div>
          <ThemeController />
          <Link className="btn btn-primary" href="/join">
            Join
          </Link>
        </div>
      </div>
    </nav>
  );
}
