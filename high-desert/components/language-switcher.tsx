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

  return (
    <div
      role="group"
      aria-label={dict.common.languageLabel}
      className="inline-flex items-center rounded-md border text-xs"
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
            disabled={isPending}
            className={cn(
              "px-3 py-1.5 transition-colors disabled:opacity-60",
              i > 0 && "border-l",
              active
                ? "bg-foreground text-background font-medium"
                : "hover:bg-accent text-muted-foreground",
            )}
          >
            {labelFor[locale]}
          </button>
        );
      })}
    </div>
  );
}
