"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
 * anchors). On mobile the ruled row becomes a compact menu, avoiding a clipped,
 * horizontally-scrollable strip and keeping every destination at a full touch-target
 * size. EN/ES stays in the dateline and is repeated inside the mobile menu so it remains
 * reachable after the dateline condenses.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const active = (href: string) => (pathname === href ? "active" : undefined);
  const [condensed, setCondensed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);

  const navItems = [
    { href: "/#charter", label: t("charter") },
    { href: "/join", label: t("membership") },
    { href: "/#exchange", label: t("exchange") },
    { href: "/preview", label: t("preview") },
    { href: "/contact", label: t("contact") },
  ];

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

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !headerRef.current?.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, [menuOpen]);

  return (
    <header
      ref={headerRef}
      className={`masthead${condensed ? " condensed" : ""}${menuOpen ? " menu-open" : ""}`}
    >
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
            {navItems.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={active(href)}
                aria-current={pathname === href ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            className="mast-menu-button"
            aria-expanded={menuOpen}
            aria-controls="mast-mobile-menu"
            aria-label={menuOpen ? t("menuClose") : t("menuOpen")}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="mast-menu-bars" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
        <div className="mast-mobile-menu" id="mast-mobile-menu">
          <nav className="wrap" aria-label="Primary">
            {navItems.map(({ href, label }, index) => (
              <Link
                key={href}
                href={href}
                className={active(href)}
                aria-current={pathname === href ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                {label}
              </Link>
            ))}
            <div className="mast-mobile-locale">
              <LocaleToggle />
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
