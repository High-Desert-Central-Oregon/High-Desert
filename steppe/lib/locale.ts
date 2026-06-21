"use server";

import { cookies } from "next/headers";
import type { Locale } from "@/i18n/request";

// Persist the marketing locale to the NEXT_LOCALE cookie (read server-side by
// i18n/request.ts). The toggle calls this, then refreshes so server components
// re-render from the chosen catalog. No URL change, no route refactor.
export async function setLocale(locale: Locale) {
  const store = await cookies();
  store.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
