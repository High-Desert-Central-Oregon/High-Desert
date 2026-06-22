import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Besley, Schibsted_Grotesk, Martian_Mono } from "next/font/google";
// Member-app brand fonts (no external CDN) — these feed app/globals.css, not the
// marketing layer, so they stay as they are.
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/playfair-display";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
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
//   data-time  Redmond's time of day (dawn 5–8, day 8–18, dusk 18–21, else night)
//   data-theme AUTOMATIC by Redmond time — night → dark, otherwise light. No manual
//              toggle (consistent with the no-end-user-toggles canon).
//   data-js    a marker so reveal-on-scroll only hides content when JS can show it
// Mirrors lib/time-of-day.ts (redmondTimeOfDay); keep the hour boundaries in sync. Only
// writes data-* the member app ignores (it themes via the next-themes `class`).
const themeInit = `(function(){try{var d=document.documentElement;d.setAttribute('data-js','');var h=parseInt(new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour:'numeric',hour12:false}).format(new Date()),10)%24;var t=(h>=5&&h<8)?'dawn':(h>=8&&h<18)?'day':(h>=18&&h<21)?'dusk':'night';d.setAttribute('data-time',t);d.setAttribute('data-theme',t==='night'?'dark':'light')}catch(e){var r=document.documentElement;r.setAttribute('data-theme','light');r.setAttribute('data-time','day')}})();`;

const defaultUrl = process.env.VERCEL_URL
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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
