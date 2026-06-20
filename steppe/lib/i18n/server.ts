import { cookies } from "next/headers";
import { LOCALE_COOKIE, defaultLocale, getDictionary, isLocale, type Locale } from "./index";

/**
 * Resolve the active locale on the server from the language cookie, falling back
 * to English. Reads a dynamic API (`cookies()`), so callers must render this work
 * inside a `<Suspense>` boundary (the app uses `cacheComponents`).
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}

/** Convenience: the resolved locale plus its dictionary in one call. */
export async function getServerDictionary() {
  const locale = await getLocale();
  return { locale, dict: getDictionary(locale) };
}
