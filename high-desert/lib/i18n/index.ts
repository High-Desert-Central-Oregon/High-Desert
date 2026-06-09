import { en, type Dictionary } from "./dictionaries/en";
import { es } from "./dictionaries/es";

/**
 * The i18n layer (CLAUDE.md invariant 9): English and Spanish ship together from
 * the first screen. A deep module behind a narrow interface — callers only ever
 * touch `getDictionary(locale)` and the `Locale` type; the dictionaries and the
 * fallback rules live here.
 */
export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

/** Name of the cookie that remembers a member's language choice. */
export const LOCALE_COOKIE = "hd_locale";

const dictionaries: Record<Locale, Dictionary> = { en, es };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** Always returns a complete dictionary; unknown locales fall back to English. */
export function getDictionary(locale: string | null | undefined): Dictionary {
  return isLocale(locale) ? dictionaries[locale] : dictionaries[defaultLocale];
}

/**
 * Fill {placeholders} in a string with named values. Keeps interpolation in one
 * place so translators never have to touch template syntax.
 *
 *   t(dict.auth.checkEmailBody, { email: "a@b.com" })
 */
export function t(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match,
  );
}

/**
 * Pick the right plural form for `count` in the active language and fill it.
 * Uses the platform's CLDR plural rules (Intl.PluralRules), so "1 ballot" vs
 * "2 ballots" — and the Spanish equivalents — are correct without hand-coding
 * each language's rules. `count` is always available as {count} in the template.
 *
 *   plural(locale, n, dict.governance.turnout)            // "1 ballot cast"
 *   plural(locale, n, dict.rsvp.spotsTaken, { going })    // extra placeholders
 */
export function plural(
  locale: string | null | undefined,
  count: number,
  forms: { one: string; other: string },
  values: Record<string, string | number> = {},
): string {
  const lc = isLocale(locale) ? locale : defaultLocale;
  const rule = new Intl.PluralRules(lc).select(count);
  const template = rule === "one" ? forms.one : forms.other;
  return t(template, { count, ...values });
}

export type { Dictionary };
