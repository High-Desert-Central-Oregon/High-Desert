import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Spectral, Archivo, Space_Mono } from "next/font/google";
// Self-hosted brand fonts (no external CDN). Variable files cover all weights;
// DM Mono ships fixed weights, so pull the two we use.
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/playfair-display";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "./globals.css";

// Marketing typefaces for the public (site) route group — the "Charter" design
// system. Optimized by next/font (no Google Fonts <link>). Exposed as CSS variables
// under names that DO NOT collide with the member app's --font-sans/--font-serif/
// --font-mono (defined in globals.css); the (site) tokens map --display/--sans/
// --mono onto these.
//   Spectral   — display serif (wordmark, headlines, commitment titles); carries italic.
//   Archivo    — body + UI + buttons.
//   Space Mono — eyebrows, labels, fine print.
const spectral = Spectral({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-display",
});
const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-mkt",
});
const spaceMono = Space_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700"],
  variable: "--font-mono-mkt",
});
const marketingFontVars = `${spectral.variable} ${archivo.variable} ${spaceMono.variable}`;

// No-flash ambient init for the marketing layer. Runs synchronously before first
// paint. The Charter design system is a single warm-white palette (no dark mode), so
// data-theme is always "light"; data-js marks that JS can reveal-on-scroll. data-time
// is still set from the local hour for any time-of-day ambiance, but the Charter hero
// uses a fixed golden landscape regardless. These data-* attributes are ignored by the
// member app (it themes via the next-themes `class`), so this is safe document-wide.
const themeInit = `(function(){try{var d=document.documentElement;d.setAttribute('data-js','');var h=new Date().getHours();var t=(h>=5&&h<8)?'dawn':(h>=8&&h<17)?'day':(h>=17&&h<20)?'dusk':'night';d.setAttribute('data-time',t);d.setAttribute('data-theme','light')}catch(e){var r=document.documentElement;r.setAttribute('data-theme','light');r.setAttribute('data-time','day')}})();`;

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
