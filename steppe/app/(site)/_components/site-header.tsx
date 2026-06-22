"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { SealMark } from "./seal-mark";
import { ThemeController } from "./theme-controller";
import { LocaleToggle } from "./locale-toggle";

/**
 * Shared marketing nav (v5 design). Seal + "Steppe" wordmark home link, the
 * Preview / For partners links with active-route styling, the EN/ES language
 * control, the day/night theme toggle, and a Join pill.
 *
 * Responsive: above the mobile breakpoint (860px) the full bar shows. At and
 * below it, the text links + bar locale control + Join CTA collapse (CSS) and a
 * hamburger appears, toggling a dropdown menu that carries the same nav links, a
 * real EN/ES control, and the Join CTA. The breakpoint is the header's existing
 * one (see site-base.css). Client component so usePathname can mark the active
 * route and manage the menu's open state, focus, and close behavior.
 */
const MOBILE_QUERY = "(min-width: 861px)";

export function SiteHeader() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const active = (href: string) => (pathname === href ? "active" : undefined);
  const closeMenu = () => setOpen(false);

  // Route change closes the menu (covers link taps, back/forward, the brand link).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // While open: close on Escape (return focus to the burger), close when the
  // viewport grows past the breakpoint, and close on a tap outside the menu/burger.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        burgerRef.current?.focus();
      }
    };
    const mq = window.matchMedia(MOBILE_QUERY);
    const onDesktop = () => {
      if (mq.matches) setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !burgerRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onDesktop);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onDesktop);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  // Move focus into the menu when it opens, for keyboard users.
  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLElement>("a, button");
    first?.focus();
  }, [open]);

  return (
    <nav className="nav">
      <div className="nav-in">
        <Link className="brand" href="/" onClick={closeMenu}>
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
          <Link className="btn btn-primary nav-cta" href="/join">
            {t("join")}
          </Link>
          <button
            ref={burgerRef}
            type="button"
            className="nav-burger"
            aria-label={open ? t("menuClose") : t("menuOpen")}
            aria-expanded={open}
            aria-controls="site-mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="burger-bars" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
        </div>
      </div>

      <div
        id="site-mobile-menu"
        ref={menuRef}
        className={`nav-menu${open ? " open" : ""}`}
      >
        <Link href="/preview" className={active("/preview")} onClick={closeMenu}>
          {t("preview")}
        </Link>
        <Link href="/partners" className={active("/partners")} onClick={closeMenu}>
          {t("partners")}
        </Link>
        <div className="nav-menu-lang">
          <LocaleToggle />
        </div>
        <Link className="btn btn-primary" href="/join" onClick={closeMenu}>
          {t("join")}
        </Link>
      </div>
    </nav>
  );
}
