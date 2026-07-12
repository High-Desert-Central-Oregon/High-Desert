import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { HorizonBand } from "@/components/broadsheet/horizon-band";
import { IconSlot } from "@/components/broadsheet/chips";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { Locale } from "@/lib/i18n";
import type { Destination } from "./nav-destinations";

/**
 * The member app's shell header (docs/audits/preview-nav-spec-v1.md §5):
 *   - all widths: the wordmark (tap → /protected home), the round search slot
 *     (the bundle's header action circle — it opens the directory search via
 *     ?s=1, so it works without JavaScript), and the EN|ES segmented language
 *     control (the bundle keeps language in the shell header),
 *   - md+ only: the four primary destinations inline — rendered from the SAME
 *     shared source as the bottom tab bar, so the two presentations cannot
 *     drift. Below md the bottom TabBar is the navigation; the old hamburger
 *     sheet and account dropdown are gone (account surfaces live under You).
 * No messages icon: M1 is not shipped, and the shell shows nothing it can't do.
 *
 * Server component — no client state left here; sign-out moved to the You page.
 */
export function AppNav({
  items,
  locale,
  wordmark,
  searchLabel,
}: {
  items: Destination[];
  locale: Locale;
  wordmark: string;
  searchLabel: string;
}) {
  const linkClass =
    "py-1 text-muted-foreground hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none";

  return (
    // The whole shell header sits on the bundle's tinted bone ground
    // (navStyle :1865: background var(--bone)); the rail's hairline below is
    // the zone's rule. Flush page mastheads continue the same bone beneath it.
    <div className="w-full bg-muted">
      {/* The bundle's horizon band tops the shell (strata + sun, decoration). */}
      <HorizonBand />
      <nav lang={locale} className="flex w-full justify-center border-b">
      {/* Rail aligns to the same --content-max column as <main>. */}
      <div className="flex w-full max-w-[var(--content-max)] items-center gap-4 p-3 px-[var(--pad-screen)] text-sm">
        <Link
          href="/protected"
          className="shrink-0 py-1 focus-visible:underline focus-visible:outline-none"
        >
          <Wordmark name={wordmark} />
        </Link>

        {/* md+ : the four destinations, one shared source with the tab bar */}
        <ul className="ml-2 hidden items-center gap-4 md:flex">
          {items.map((it) => (
            <li key={it.key}>
              <Link href={it.href} className={linkClass}>
                {it.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-[9px]">
          {/* The bundle's round header search slot (inner.html :448) — global
              on member routes; targets the groups directory, the one indexed
              search surface, and stays a plain link (?s=1, JS-optional). */}
          <Link
            href="/protected/groups?s=1"
            aria-label={searchLabel}
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
          <LanguageSwitcher current={locale} />
        </div>
      </div>
      </nav>
    </div>
  );
}
