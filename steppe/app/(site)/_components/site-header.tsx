"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { SealMark } from "./seal-mark";
import { LocaleToggle } from "./locale-toggle";

/**
 * Shared marketing masthead (Broadsheet × Plate). A newspaper-style head: a mono
 * dateline bar (Vol. / place · Est., stacks on mobile), the Besley "Steppe" wordmark
 * with the Strata Seal, and a ruled nav (Charter · Membership · Exchange · Preview)
 * closed by a 3px ink + 2px rust double rule. The EN/ES control rides in the dateline
 * bar (kept for the bilingual commitment); there is no theme toggle — the broadsheet
 * is a single paper palette. Charter/Exchange are home anchors; from another route they
 * navigate home then scroll. Client component for usePathname (active nav route).
 */
export function SiteHeader() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const active = (href: string) => (pathname === href ? "active" : undefined);

  return (
    <header className="masthead">
      <div className="mast-top">
        <div className="wrap">
          <span>Vol. I · No. 1</span>
          <span className="mast-right">
            <span>Redmond · Central Oregon · Est. 2026</span>
            <LocaleToggle />
          </span>
        </div>
      </div>
      <div className="mast">
        <div className="wrap">
          <Link className="wm" href="/">
            <SealMark clipId="seal-nav" />
            Steppe
          </Link>
          <nav className="bnav" aria-label="Primary">
            <Link href="/#charter">{t("charter")}</Link>
            <Link href="/join" className={active("/join")}>
              {t("membership")}
            </Link>
            <Link href="/#exchange">{t("exchange")}</Link>
            <Link href="/preview" className={active("/preview")}>
              {t("preview")}
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
