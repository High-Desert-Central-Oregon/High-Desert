import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppNav, type NavItem } from "./app-nav";
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

async function NavBar() {
  const { locale, dict } = await getServerDictionary();
  const profile = await getMyProfile();
  const user = await getCurrentUser();
  const isMod = profile?.role === "moderator" || profile?.role === "admin";
  const verified = profile?.verified ?? false;

  // Primary destinations sit inline at md+ and in the mobile sheet; the rest
  // (account + role-gated surfaces) consolidate into one menu at md+ so the bar
  // never wraps. The mobile sheet lists primary + account together.
  const primary: NavItem[] = [
    ...(verified
      ? [
          { href: "/protected/events", label: dict.nav.eventsLink },
          { href: "/protected/groups", label: dict.nav.groupsLink },
          { href: "/protected/governance", label: dict.nav.governanceLink },
        ]
      : []),
    { href: "/protected/neighborhoods", label: dict.nav.neighborhoodLink },
    { href: "/protected/transparency", label: dict.nav.transparencyLink },
  ];

  const account: NavItem[] = [
    { href: "/protected/account", label: dict.nav.accountLink },
    ...(!verified ? [{ href: "/protected/verify", label: dict.nav.verifyLink }] : []),
    ...(isMod
      ? [
          { href: "/protected/review", label: dict.nav.reviewLink },
          { href: "/protected/moderation", label: dict.nav.appealsLink },
        ]
      : []),
  ];

  return (
    <AppNav
      primary={primary}
      account={account}
      locale={locale}
      wordmark={dict.app.name}
      email={user?.email ?? null}
      labels={{
        menu: dict.nav.openMenu,
        close: dict.nav.closeMenu,
        signOut: dict.nav.signOut,
        account: dict.nav.accountLink,
      }}
    />
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

      {/* ONE centered reading column (--content-max) with the reference sheet
          rhythm: screen pad 22px, row rhythm 25px. The phone composition given
          room — no second column, no sidebar. */}
      <main
        id="main"
        className="flex w-full max-w-[var(--content-max)] flex-1 flex-col gap-[var(--row-rhythm)] p-[var(--pad-screen)]"
      >
        {children}
      </main>
    </div>
  );
}
