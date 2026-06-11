import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
// Self-hosted brand fonts (no external CDN). Variable files cover all weights;
// DM Mono ships fixed weights, so pull the two we use.
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/playfair-display";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "High Desert — Redmond, Oregon",
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
    <html lang="en" suppressHydrationWarning>
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
