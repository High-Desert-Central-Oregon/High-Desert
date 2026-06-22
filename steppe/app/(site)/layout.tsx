// Public marketing layer (the (site) route group). Fully static and public — no
// auth, no Supabase, no data access. It nests under the app's root layout
// (<html>/<body>/ThemeProvider) and adds the marketing design tokens, scoped to a
// .site-root wrapper so nothing bleeds into the member app.
//
// Marketing typefaces (Besley / Schibsted Grotesk / Martian Mono) are loaded by
// next/font in app/layout.tsx and consumed through the --display/--sans/--mono
// tokens defined in tokens.css.
import "./tokens.css";
import "./site-base.css";

import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { SiteHeader } from "./_components/site-header";
import { SiteFooter } from "./_components/site-footer";

// Locale comes from the NEXT_LOCALE cookie (i18n/request.ts); the client provider
// makes the active catalog available to client components (header toggle, etc.).
// The cookie read makes the marketing pages locale-dynamic, so the shell that
// reads it lives inside a Suspense boundary — required by cacheComponents
// (dynamicIO), which we keep enabled. The prelaunch middleware is untouched.
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <LocalizedShell>{children}</LocalizedShell>
    </Suspense>
  );
}

async function LocalizedShell({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="site-root">
        <SiteHeader />
        {children}
        <SiteFooter />
      </div>
    </NextIntlClientProvider>
  );
}
