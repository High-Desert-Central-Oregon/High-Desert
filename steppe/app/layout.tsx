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
