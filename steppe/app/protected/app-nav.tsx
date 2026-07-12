import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { HorizonBand } from "@/components/broadsheet/horizon-band";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { Locale } from "@/lib/i18n";
import type { Destination } from "./nav-destinations";

/**
 * The member app's shell header (docs/audits/preview-nav-spec-v1.md §5):
 *   - all widths: the wordmark (tap → /protected home) + the EN|ES segmented
 *     language control (the bundle keeps language in the shell header),
 *   - md+ only: the four primary destinations inline — rendered from the SAME
 *     shared source as the bottom tab bar, so the two presentations cannot
 *     drift. Below md the bottom TabBar is the navigation; the old hamburger
 *     sheet and account dropdown are gone (account surfaces live under You).
 *
 * Server component — no client state left here; sign-out moved to the You page.
 */
export function AppNav({
  items,
  locale,
  wordmark,
}: {
  items: Destination[];
  locale: Locale;
  wordmark: string;
}) {
  const linkClass =
    "py-1 text-muted-foreground hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none";

  return (
    <div className="w-full">
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

        <div className="ml-auto flex items-center">
          <LanguageSwitcher current={locale} />
        </div>
      </div>
      </nav>
    </div>
  );
}
