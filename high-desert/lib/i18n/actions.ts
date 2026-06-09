"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, defaultLocale, isLocale } from "./index";

/**
 * Remember a member's language choice. Stored in a cookie for everyone (so the
 * choice survives before sign-in), and also persisted to `profiles.locale` for
 * signed-in members via their own session — Row-Level Security still gates the
 * write, and the profile-guard trigger leaves `locale` editable by its owner
 * (only verified/role/tenure are frozen).
 */
export async function setLocale(next: string): Promise<void> {
  const locale = isLocale(next) ? next : defaultLocale;

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // one year
    sameSite: "lax",
  });

  // Best-effort profile sync; the cookie is the source of truth for the UI.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (userId) {
    await supabase.from("profiles").update({ locale }).eq("id", userId);
  }
}
