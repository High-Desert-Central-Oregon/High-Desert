import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

// Supported marketing locales. English is the source of truth; Spanish is a
// draft pending fluent review (see messages/es.json). Prefix routing (/es/...)
// is a later upgrade.
// TODO: localized path routing (/es/...) for SEO
export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get("NEXT_LOCALE")?.value;
  const locale: Locale = cookieLocale === "es" ? "es" : defaultLocale;
  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
