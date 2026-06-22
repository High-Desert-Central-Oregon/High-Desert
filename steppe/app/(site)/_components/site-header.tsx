"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { SealMark } from "./seal-mark";
import { LocaleToggle } from "./locale-toggle";

/**
 * Shared marketing nav — Charter system. Deliberately minimal for the prelaunch
 * site: the seal + "Steppe" wordmark (Spectral) home link, the EN/ES language
 * control, and a single Join CTA. No section links, no theme toggle (Charter is a
 * single warm-white palette). It fits inline at every breakpoint, so there's no
 * hamburger menu.
 */
export function SiteHeader() {
  const t = useTranslations("nav");

  return (
    <nav className="nav">
      <div className="nav-in">
        <Link className="brand" href="/">
          <SealMark clipId="seal-nav" />
          Steppe
        </Link>
        <div className="nav-right">
          <LocaleToggle />
          <Link className="btn btn-primary nav-cta" href="/join">
            {t("join")}
          </Link>
        </div>
      </div>
    </nav>
  );
}
