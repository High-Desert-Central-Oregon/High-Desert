import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  cacheComponents: true,
};

// next-intl in "without i18n routing" mode: locale comes from the NEXT_LOCALE
// cookie (see i18n/request.ts). No middleware, no app/[locale] restructure — the
// existing LAUNCH_PHASE prelaunch middleware is left untouched.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
