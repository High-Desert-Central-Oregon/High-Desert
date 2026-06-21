import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Newsreader, Libre_Franklin, DM_Mono } from "next/font/google";
// Self-hosted brand fonts (no external CDN). Variable files cover all weights;
// DM Mono ships fixed weights, so pull the two we use.
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/playfair-display";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "./globals.css";

// Marketing typefaces for the public (site) route group — self-hosted and
// optimized by next/font (no Google Fonts <link>). Exposed as CSS variables under
// names that DO NOT collide with the member app's --font-sans/--font-serif/
// --font-mono (defined in globals.css); the (site) tokens map --display/--sans/
// --mono onto these. Newsreader carries italic + the optical-size axis.
const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-display",
});
const libreFranklin = Libre_Franklin({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  variable: "--font-sans-mkt",
});
const dmMono = DM_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
  variable: "--font-mono-mkt",
});
const marketingFontVars = `${newsreader.variable} ${libreFranklin.variable} ${dmMono.variable}`;

// No-flash ambient init for the marketing layer. Runs synchronously before first
// paint so the (site) pages never flash the wrong theme or sky. Sets, on <html>:
//   data-time  from the local hour (dawn 5–8, day 8–17, dusk 17–20, else night)
//   data-theme = saved manual override if present, otherwise AUTOMATIC by time of
//                day (night → dark, otherwise → light) so it tracks the strata.
//                Time wins; prefers-color-scheme is no longer the primary source.
//   data-js    a marker so reveal-on-scroll only hides content when JS can show it
// This only writes data-* attributes the member app ignores (it themes via the
// next-themes `class`), so it is safe to run document-wide. ThemeController keeps
// it current across sunset/sunrise and handles the manual override.
const themeInit = `(function(){try{var d=document.documentElement;d.setAttribute('data-js','');var h=new Date().getHours();var t=(h>=5&&h<8)?'dawn':(h>=8&&h<17)?'day':(h>=17&&h<20)?'dusk':'night';d.setAttribute('data-time',t);var s=null;try{s=localStorage.getItem('steppe-theme')}catch(e){}var th=(s==='light'||s==='dark')?s:(t==='night'?'dark':'light');d.setAttribute('data-theme',th)}catch(e){var r=document.documentElement;r.setAttribute('data-theme','light');r.setAttribute('data-time','day')}})();`;

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
