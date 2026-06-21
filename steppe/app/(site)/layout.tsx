// Public marketing layer (the (site) route group). Fully static and public — no
// auth, no Supabase, no data access. It nests under the app's root layout
// (<html>/<body>/ThemeProvider) and adds the marketing design tokens, scoped to a
// .site-root wrapper so nothing bleeds into the member app.
//
// Marketing typefaces (Newsreader / Libre Franklin / DM Mono) are loaded by
// next/font in app/layout.tsx and consumed through the --display/--sans/--mono
// tokens defined in tokens.css.
import "./tokens.css";
import "./site-base.css";

import { SiteHeader } from "./_components/site-header";
import { SiteFooter } from "./_components/site-footer";
import { ThemeController } from "./_components/theme-controller";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="site-root">
      {/* Temporary mount so the theme/time controller is live + testable in
          Part 2; Part 3 relocates <ThemeController /> into the nav. */}
      <ThemeController />
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
