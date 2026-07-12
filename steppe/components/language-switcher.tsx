"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/lib/i18n/actions";
import { locales, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Two-button language toggle (English / Español). Persists the choice via a
 * server action, then refreshes so the server re-renders in the new language.
 * Kept keyboard-operable and labelled for screen readers (invariant 9).
 */
export function LanguageSwitcher({ current }: { current: Locale }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const dict = getDictionary(current);

  const choose = (locale: Locale) => {
    if (locale === current) return;
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  };

  const labelFor: Record<Locale, string> = {
    en: dict.common.english,
    es: dict.common.spanish,
  };

  // EN|ES segmented control, the bundle's shell-header language toggle
  // (preview-nav-spec §4: mono codes; active = ink fill / paper text). The full
  // language names stay on aria-labels for screen readers (invariant 9).
  return (
    <div
      role="group"
      aria-label={dict.common.languageLabel}
      className="inline-flex items-center border"
    >
      {locales.map((locale, i) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            onClick={() => choose(locale)}
            aria-pressed={active}
            aria-label={labelFor[locale]}
            disabled={isPending}
            className={cn(
              "px-[11px] py-[5px] font-mono text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors disabled:opacity-60",
              i > 0 && "border-l",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {locale.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
