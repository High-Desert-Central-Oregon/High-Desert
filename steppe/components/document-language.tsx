"use client";

import { useEffect } from "react";

/** Keep the document language aligned with the locale resolved by each shell. */
export function DocumentLanguage({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
