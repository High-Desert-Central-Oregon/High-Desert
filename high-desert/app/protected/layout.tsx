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

async function NavBar() {
  const { locale, dict } = await getServerDictionary();
  const profile = await getMyProfile();
  const isMod = profile?.role === "moderator" || profile?.role === "admin";
  const verified = profile?.verified ?? false;

  return (
    <nav className="flex h-16 w-full justify-center border-b">
      <div className="flex w-full max-w-3xl items-center justify-between gap-3 p-3 px-5 text-sm">
        <div className="flex items-center gap-4">
          <Link href="/protected" className="font-semibold tracking-tight">
            {dict.app.name}
          </Link>
          <Link
            href="/protected/neighborhoods"
            className="text-muted-foreground hover:text-foreground hover:underline"
          >
            {dict.nav.neighborhoodLink}
          </Link>
          {!verified && (
            <Link
              href="/protected/verify"
              className="text-muted-foreground hover:text-foreground hover:underline"
            >
              {dict.nav.verifyLink}
            </Link>
          )}
          {isMod && (
            <Link
              href="/protected/review"
              className="text-muted-foreground hover:text-foreground hover:underline"
            >
              {dict.nav.reviewLink}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3">
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
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to main content
      </a>

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
