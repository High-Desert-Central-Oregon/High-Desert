"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Destination } from "./nav-destinations";

/**
 * Bottom tab bar (< md) — the preview bundle's typographic tab bar, adopted per
 * docs/audits/preview-nav-spec-v1.md §1: NO icons — a 7px rust blaze marks the
 * active tab (inactive tabs reserve the same space so labels never shift), then
 * a 10px uppercase Martian Mono label. Bone ground, 2px ink rule on top, 72px
 * total including the safe-area inset.
 */

/** Form controls the discard guard watches. Radios/checkboxes are excluded on
 *  purpose — they are one-tap actions (RSVP), not drafts. */
const CONTROL_SELECTOR =
  'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select';

type WatchedControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function isWatched(el: EventTarget | null): el is WatchedControl {
  return (
    (el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement) &&
    el.matches(CONTROL_SELECTOR) &&
    el.closest("main") !== null
  );
}

export function TabBar({
  items,
  locale,
  navLabel,
  confirmDiscard,
}: {
  items: Destination[];
  locale: string;
  navLabel: string;
  confirmDiscard: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Dirty means "differs from what the member found on screen": each control's
  // value is snapshotted the first time it receives focus (its initial render
  // value — focus always precedes typing/picking), and the guard compares
  // against THAT. Controls the member never touched contribute nothing, so a
  // pristine form never prompts — even with prefilled fields (the seeded
  // opens_at on /governance/new), where the old value-vs-defaultValue check
  // false-fired on datetime-local normalization. Snapshots live in a WeakMap
  // keyed by element, so they die with the page's DOM on navigation.
  const initialValues = useRef<WeakMap<WatchedControl, string>>(new WeakMap());

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target;
      if (isWatched(el) && !initialValues.current.has(el)) {
        initialValues.current.set(el, el.value);
      }
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  const hasUnsavedInput = (): boolean => {
    const controls = document.querySelectorAll<WatchedControl>(
      `main :is(${CONTROL_SELECTOR})`,
    );
    for (const el of controls) {
      const initial = initialValues.current.get(el);
      if (initial !== undefined && el.value !== initial) return true;
    }
    return false;
  };

  const onTap = (e: React.MouseEvent, href: string) => {
    // A form in progress must not be silently discarded (spec Part 1 exception).
    if (hasUnsavedInput() && !window.confirm(confirmDiscard)) {
      e.preventDefault();
      return;
    }
    // INTENTIONAL (bundle-native, inner.html goTab :1720): any tap — including
    // re-tapping the active tab — pops to the tab's ROOT and resets scroll. The
    // Link already targets the root; on an exact re-tap we refresh + scroll top
    // so the reset behavior comes free, exactly like the preview.
    if (pathname === href) {
      e.preventDefault();
      window.scrollTo({ top: 0 });
      router.refresh();
    }
  };

  return (
    <nav
      aria-label={navLabel}
      lang={locale}
      className="fixed inset-x-0 bottom-0 z-40 flex border-t-2 border-foreground bg-muted pb-[max(env(safe-area-inset-bottom),18px)] md:hidden"
    >
      {items.map((it) => {
        const active =
          pathname === it.href || pathname.startsWith(it.href + "/");
        return (
          <Link
            key={it.key}
            href={it.href}
            onClick={(e) => onTap(e, it.href)}
            aria-current={active ? "page" : undefined}
            className="flex min-h-[46px] flex-1 flex-col items-center pt-2.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {/* The blaze: rust triangle when active; the same 7px box, transparent,
                when not — labels never shift (spec §1). */}
            <span
              aria-hidden="true"
              className={cn(
                "mb-[7px] h-0 w-0",
                active
                  ? "border-x-[6px] border-b-[7px] border-x-transparent border-b-accent"
                  : "border-b-[7px] border-b-transparent",
              )}
            />
            <span
              className={cn(
                "font-mono text-[10px] font-semibold uppercase tracking-[0.1em]",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {it.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
