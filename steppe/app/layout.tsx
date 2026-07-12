import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Besley, Schibsted_Grotesk, Martian_Mono } from "next/font/google";
// ONE brand type system across the whole app: Besley / Schibsted Grotesk /
// Martian Mono are loaded once below (next/font, no external CDN) and drive both
// the marketing layer AND the member app — globals.css points the shadcn
// --font-* contract at these same faces. (DM Sans / Playfair / DM Mono removed
// 2026-07-10: the member app now shares the brand fonts, so those extra @fontsource
// copies are gone.)
import "./globals.css";

// Marketing typefaces for the public (site) route group — self-hosted and optimized
// by next/font (no Google Fonts <link>; nothing hits fonts.gstatic.com at runtime).
// Exposed as CSS variables under names that DO NOT collide with the member app's
// --font-sans/--font-serif/--font-mono (defined in globals.css); the (site) tokens
// map --display/--sans/--mono onto these. All three are variable fonts (full weight
// range — no `weight`); Besley carries the italic used for emphasis.
//   Besley            — display slab serif (headings, hero, large numerals).
//   Schibsted Grotesk — body / UI / nav / buttons.
//   Martian Mono      — eyebrows, datelines, tags, the $4 stamp, ledger, footer micro.
const besley = Besley({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display",
});
const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans-mkt",
});
const martianMono = Martian_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-mkt",
});
const marketingFontVars = `${besley.variable} ${schibsted.variable} ${martianMono.variable}`;

// No-flash ambient init for the marketing layer. Runs synchronously before first paint
// so the (site) pages never flash the wrong theme or sky. Sets, on <html>:
//   data-time  Redmond's time of day (dawn 5–8, day 8–18, dusk 18–21, else night) —
//              the hero sky/sun ambience.
//   data-theme AUTOMATIC by that same clock (night → dark, otherwise light) — a
//              stored explicit sun/moon choice (localStorage "steppe-theme", set by
//              the ThemeController) overrides the clock. OS preference never does.
//   data-js    a marker so reveal-on-scroll only hides content when JS can show it
// Mirrors lib/time-of-day.ts (redmondTimeOfDay); keep the hour boundaries and the
// night→dark mapping in sync. Only writes data-* the member app ignores — /protected
// and /auth theme via the next-themes class, forced light below.
const themeInit = `(function(){try{var d=document.documentElement;d.setAttribute('data-js','');var h=parseInt(new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour:'numeric',hour12:false}).format(new Date()),10)%24;var t=(h>=5&&h<8)?'dawn':(h>=8&&h<18)?'day':(h>=18&&h<21)?'dusk':'night';d.setAttribute('data-time',t);var m=null;try{m=localStorage.getItem('steppe-theme')}catch(e){}d.setAttribute('data-theme',(m==='dark'||m==='light')?m:(t==='night'?'dark':'light'))}catch(e){var r=document.documentElement;r.setAttribute('data-theme','light');r.setAttribute('data-time','day')}})();`;

// Canonical site origin for absolute metadata URLs (OG/Twitter cards, canonical).
// Prefer the explicit NEXT_PUBLIC_SITE_URL (set to https://www.steppe.community in
// prod) so shared links resolve to the real domain, not the *.vercel.app machine
// name; VERCEL_URL remains the fallback so preview deploys stay self-referential.
const defaultUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Steppe — Redmond, Oregon",
  description:
    "Community-owned, verified, ad-free civic infrastructure for Redmond, Oregon.",
};

// Fonts are self-hosted (@fontsource, imported in globals.css) and applied
// through the --font-* CSS variables / Tailwind families — no external CDN.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={marketingFontVars}>
      <body className="font-sans antialiased">
        {/* Marketing no-flash ambient init — must run before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {/* The member app is LIGHT-ONLY: forcedTheme pins next-themes' class to
            light regardless of any stored "theme" key or OS preference, so the
            .dark token block in globals.css (kept for a future member toggle)
            can never apply. The marketing layer themes independently via
            data-theme above — the clock never reaches member surfaces. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
