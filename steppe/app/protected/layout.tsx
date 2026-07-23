import { Suspense } from "react";
import { redirect } from "next/navigation";
import { InstallAffordance } from "@/components/install-affordance";
import { AppNav } from "./app-nav";
import { TabBar } from "./tab-bar";
import { destinations } from "./nav-destinations";
import { getCurrentUser } from "@/lib/auth";
import { getConsentState } from "@/lib/onboarding";
import { getServerDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getUnreadState } from "@/lib/messages";

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

/** Server shim: fetch the dictionary once, hand it to the client affordance. */
async function InstallBanner() {
  const { locale, dict } = await getServerDictionary();
  return <InstallAffordance locale={locale} dict={dict} />;
}

async function NavBar() {
  const { locale, dict } = await getServerDictionary();
  // Poll-on-nav unread signal (messages-m1-spec §6): recomputed each server
  // navigation, RLS-scoped to the member, a boolean (never a count). A signed-
  // out or unverified member simply has no threads → no dot.
  let hasUnread = false;
  const user = await getCurrentUser();
  if (user) {
    const supabase = await createClient();
    hasUnread = await getUnreadState(supabase, user.id);
  }
  // One shared destination source drives BOTH the md+ rail here and the <md
  // bottom TabBar below (preview-nav-spec §1/§5) — the two cannot drift. Tabs
  // are not verification-gated: the pages gate (spec §2). Neighborhood, Verify,
  // Reviews and Appeals now live as sections under You (/protected/account).
  return (
    <AppNav
      items={destinations(dict)}
      locale={locale}
      wordmark={dict.app.name}
      searchLabel={dict.nav.searchLabel}
      messagesLabel={dict.nav.messagesLabel}
      unreadLabel={dict.messages.unread}
      hasUnread={hasUnread}
    />
  );
}

async function BottomTabs() {
  const { locale, dict } = await getServerDictionary();
  return (
    <TabBar
      items={destinations(dict)}
      locale={locale}
      navLabel={dict.nav.home}
      confirmDiscard={dict.nav.confirmDiscard}
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

      {/* Add-to-home-screen affordance — above the nav. Client-only logic that
          renders nothing until a real install path exists; dismissible, and the
          You-tab row remains the persistent door. */}
      <Suspense>
        <InstallBanner />
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
        className="flex w-full max-w-[var(--content-max)] flex-1 flex-col gap-[var(--row-rhythm)] p-[var(--pad-screen)] max-md:pb-24"
      >
        {children}
      </main>

      {/* Bottom tab bar (< md) — the mobile navigation; the main column above
          reserves clearance for it (max-md:pb-24). */}
      <Suspense>
        <BottomTabs />
      </Suspense>
    </div>
  );
}
