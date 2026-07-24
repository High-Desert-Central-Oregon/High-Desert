import { cache } from "react";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, defaultLocale, getDictionary, isLocale, type Locale } from "./index";

/**
 * Resolve the active locale on the server from the language cookie, falling back
 * to English. Reads a dynamic API (`cookies()`), so callers must render this work
 * inside a `<Suspense>` boundary (the app uses `cacheComponents`).
 *
 * Wrapped in React `cache()` so it runs at most ONCE per request (same pattern as
 * F4's getCurrentUser): the protected layout resolves the dictionary 4× per
 * render (SkipLink, InstallBanner, NavBar, BottomTabs) and every getServerDictionary
 * funnels through here, so this collapses those to a single cookie read.
 * Request-scoped and reset each request, and the locale cookie is fixed within a
 * request (a language switch is a new request), so the memo is transparent.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
});

/** Convenience: the resolved locale plus its dictionary in one call. */
export async function getServerDictionary() {
  const locale = await getLocale();
  return { locale, dict: getDictionary(locale) };
}
