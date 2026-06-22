"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { SealMark } from "./seal-mark";
import { LocaleToggle } from "./locale-toggle";

/**
 * Shared marketing masthead (Broadsheet × Plate) — sticky + condensing. At the top of
 * the page the full masthead shows (dateline bar + wordmark + ruled nav). On scroll it
 * condenses into a slim sticky bar (wordmark + nav) so the links stay reachable at any
 * scroll position. Reduced motion → condense instantly (CSS guards the transition).
 *
 * Nav: Charter · Membership · Exchange · Preview · Contact (Charter/Exchange are home
 * anchors). On mobile the row becomes a horizontally-scrollable strip so every link is
 * reachable on small screens. EN/ES rides in the dateline bar; no theme toggle (single
 * paper palette; the day/night theme is automatic — Part 6).
 */
export function SiteHeader() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const active = (href: string) => (pathname === href ? "active" : undefined);
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    // Hysteresis (condense >96, release <32) with an rAF throttle. The dead band is
    // wider than the ~50px the header loses when it condenses, so the scroll-anchoring
    // nudge that height change causes can't re-cross the threshold — no condense/expand
    // loop at the boundary.
    let ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      setCondensed((prev) => (prev ? y > 32 : y > 96));
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`masthead${condensed ? " condensed" : ""}`}>
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
            <Link href="/contact" className={active("/contact")}>
              {t("contact")}
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
