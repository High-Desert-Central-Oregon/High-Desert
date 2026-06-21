"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { SealMark } from "./seal-mark";
import { ThemeController } from "./theme-controller";
import { LocaleToggle } from "./locale-toggle";

/**
 * Shared marketing nav (v5 design). Seal + "Steppe" wordmark home link, the
 * Preview / For partners links with active-route styling, the EN/ES language
 * control, the day/night theme toggle, and a Join pill. Client component so
 * usePathname can mark the active route. On mobile the text links collapse (CSS)
 * leaving the language + theme toggles and Join visible.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const t = useTranslations("nav");
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
              {t("preview")}
            </Link>
            <Link href="/partners" className={active("/partners")}>
              {t("partners")}
            </Link>
          </div>
          <LocaleToggle />
          <ThemeController />
          <Link className="btn btn-primary" href="/join">
            {t("join")}
          </Link>
        </div>
      </div>
    </nav>
  );
}
