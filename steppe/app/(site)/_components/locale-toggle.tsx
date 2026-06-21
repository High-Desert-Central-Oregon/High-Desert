"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/lib/locale";

/**
 * EN / ES language control for the shared header (desktop + mobile). Reflects the
 * active locale, persists the choice via the NEXT_LOCALE cookie (setLocale server
 * action), then refreshes so server components re-render from the chosen catalog.
 */
export function LocaleToggle() {
  const locale = useLocale();
  const t = useTranslations("locale");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (next: "en" | "es") => {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  };

  return (
    <div className="lang" role="group" aria-label={t("label")} aria-busy={pending}>
      <button
        type="button"
        className={locale === "en" ? "on" : undefined}
        aria-pressed={locale === "en"}
        onClick={() => choose("en")}
      >
        {t("en")}
      </button>
      <span aria-hidden="true">·</span>
      <button
        type="button"
        className={locale === "es" ? "on" : undefined}
        aria-pressed={locale === "es"}
        onClick={() => choose("es")}
      >
        {t("es")}
      </button>
    </div>
  );
}
