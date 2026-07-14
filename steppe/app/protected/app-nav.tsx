import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { HorizonBand } from "@/components/broadsheet/horizon-band";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SearchSlot } from "./search-slot";
import { MessagesSlot } from "./messages-slot";
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
 * The messages slot ships with M1 (no dead icons); its unread dot is
 * server-computed per navigation (poll-on-nav, lib/messages.ts).
 *
 * Server component — no client state left here; sign-out moved to the You page.
 */
export function AppNav({
  items,
  locale,
  wordmark,
  searchLabel,
  messagesLabel,
  unreadLabel,
  hasUnread,
}: {
  items: Destination[];
  locale: Locale;
  wordmark: string;
  searchLabel: string;
  messagesLabel: string;
  unreadLabel: string;
  hasUnread: boolean;
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
              on member routes and SCOPE-AWARE: the Exchange searches the
              Exchange, everywhere else searches groups (?s=1, JS-optional). */}
          <SearchSlot label={searchLabel} />
          {/* The messages slot (bundle :452-455) — ships with M1 (no dead
              icons); the unread dot is server-computed per navigation. */}
          <MessagesSlot
            label={messagesLabel}
            unreadLabel={unreadLabel}
            hasUnread={hasUnread}
          />
          <LanguageSwitcher current={locale} />
        </div>
      </div>
      </nav>
    </div>
  );
}
