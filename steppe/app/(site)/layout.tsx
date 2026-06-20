// Public marketing layer (the (site) route group). Fully static and public — no
// auth, no Supabase, no data access. It nests under the app's root layout
// (<html>/<body>/ThemeProvider) and adds the brand fonts + tokens, scoped to a
// .site-root wrapper so nothing bleeds into the member app.
//
// Self-hosted brand fonts (no external CDN — the design's Google Fonts <link> is
// replaced with the same families via @fontsource, preserving the exact type).
import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/400-italic.css";
import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/500.css";
import "@fontsource/public-sans/600.css";

import "@/styles/brand-tokens.css";
import "./site-base.css";

import { SiteHeader } from "./_components/site-header";
import { SiteFooter } from "./_components/site-footer";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="site-root">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
