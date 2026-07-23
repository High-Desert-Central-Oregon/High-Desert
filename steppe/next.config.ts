import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  cacheComponents: true,
};

// next-intl in "without i18n routing" mode: locale comes from the NEXT_LOCALE
// cookie (see i18n/request.ts). No middleware, no app/[locale] restructure — the
// existing LAUNCH_PHASE prelaunch middleware is left untouched.
const withNextIntl = createNextIntlPlugin();

// PWA service worker for Android WebAPK installability — see app/sw.ts and
// docs/pwa-service-worker.md. Kept minimal on purpose:
//   • disable in dev so the SW never interferes with hot reload or local auth
//     debugging (dev keeps using Turbopack; only `build` runs webpack below).
//   • reloadOnOnline:false — no surprise page reloads when the network returns.
//   • the SW precaches NOTHING — self.__SW_MANIFEST injects as []. Two options
//     enforce that, because @serwist/next builds the manifest from two sources:
//       exclude:[/./]        drops every webpack build chunk, and
//       globPublicPatterns:[] drops every file under public/.
//     The empty manifest is what makes "the SW caches nothing" true.
// @serwist/next compiles the SW with webpack, so `next build` must run with
// --webpack (see package.json). The baseline webpack build was verified to work
// before adding this.
const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: false,
  exclude: [/./],
  globPublicPatterns: [],
});

export default withSerwist(withNextIntl(nextConfig));
