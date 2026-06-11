import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthButton } from "@/components/auth-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getCurrentUser, getMyProfile } from "@/lib/auth";
import { getConsentState } from "@/lib/onboarding";
import { getServerDictionary } from "@/lib/i18n/server";

/**
 * Guards the signed-in area. Two gates, both server-enforced:
 *   1. signed in (the proxy enforces this too — defense in depth), and
 *   2. has agreed to the current Terms & Privacy, else off to the consent gate.
 *
 * This is a *flow* gate; the hard security gates for participation (events,
 * votes) live in Row-Level Security keyed on `verified`, not here. Rendered in a
 * Suspense boundary because it reads cookies/claims (the app uses
 * `cacheComponents`). A thrown redirect aborts the whole response.
 */
async function ConsentGuard() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const { hasConsentedAll } = await getConsentState();
  if (!hasConsentedAll) redirect("/welcome");

  return null;
}

/** Localized skip link — the first focusable element, so keyboard users can jump
 *  past the nav straight to the page content. */
async function SkipLink() {
  const { locale, dict } = await getServerDictionary();
  return (
    <a
      href="#main"
      lang={locale}
      className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2 focus:shadow"
    >
      {dict.nav.skipToContent}
    </a>
  );
}

/** A nav link with a thumb-sized hit area and a visible keyboard-focus style. */
function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="py-1 text-muted-foreground hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none"
    >
      {children}
    </Link>
  );
}

async function NavBar() {
  const { locale, dict } = await getServerDictionary();
  const profile = await getMyProfile();
  const isMod = profile?.role === "moderator" || profile?.role === "admin";
  const verified = profile?.verified ?? false;

  // Mobile-first: the whole bar is one wrapping flex row, so on a narrow phone
  // the links flow onto extra lines instead of forcing horizontal scroll. The
  // controls sit right via ml-auto on a wide screen and drop to their own line
  // when wrapped. Height comes from padding, not a fixed h-16.
  return (
    <nav lang={locale} className="flex w-full justify-center border-b">
      <div className="flex w-full max-w-3xl flex-wrap items-center gap-x-4 gap-y-1 p-3 px-5 text-sm">
        <Link
          href="/protected"
          className="py-1 font-semibold tracking-tight"
        >
          {dict.app.name}
        </Link>
        {verified && (
          <NavLink href="/protected/events">{dict.nav.eventsLink}</NavLink>
        )}
        {verified && (
          <NavLink href="/protected/governance">
            {dict.nav.governanceLink}
          </NavLink>
        )}
        <NavLink href="/protected/neighborhoods">
          {dict.nav.neighborhoodLink}
        </NavLink>
        <NavLink href="/protected/transparency">
          {dict.nav.transparencyLink}
        </NavLink>
        <NavLink href="/protected/account">{dict.nav.accountLink}</NavLink>
        {!verified && (
          <NavLink href="/protected/verify">{dict.nav.verifyLink}</NavLink>
        )}
        {isMod && (
          <NavLink href="/protected/review">{dict.nav.reviewLink}</NavLink>
        )}
        {isMod && (
          <NavLink href="/protected/moderation">{dict.nav.appealsLink}</NavLink>
        )}
        <div className="ml-auto flex items-center gap-3">
          <LanguageSwitcher current={locale} />
          <Suspense>
            <AuthButton />
          </Suspense>
        </div>
      </div>
    </nav>
  );
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center">
      <Suspense>
        <SkipLink />
      </Suspense>

      <Suspense fallback={<div className="h-16 w-full border-b" />}>
        <NavBar />
      </Suspense>

      {/* Redirects unconsented/anonymous members away before they see content. */}
      <Suspense>
        <ConsentGuard />
      </Suspense>

      <main id="main" className="flex w-full max-w-3xl flex-1 flex-col gap-8 p-5">
        {children}
      </main>
    </div>
  );
}
