"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteOrigin } from "@/lib/site-url";

/**
 * Request a magic-link sign-in — INVITE-ONLY (migration 0024).
 *
 * The allowlist check runs HERE, server-side, so it can't be skipped by a
 * tampered client. Only an email on `invited_emails` is sent a link (and, if it
 * has no account yet, `shouldCreateUser: true` creates one). The database is the
 * real enforcement: `enforce_invited_signup()` refuses a non-allowlisted signup
 * even if someone calls GoTrue directly with the public key — this action is the
 * clean-UX first line, that trigger is the guarantee.
 *
 * NO ENUMERATION ORACLE: the return is identical for every well-formed email —
 * allowlisted-with-account, allowlisted-without-account, and not-allowlisted all
 * get `{ ok: true }` and the same neutral "if that address can join…" screen.
 * We only ever actually send for an allowlisted address; the caller can't tell
 * the difference. The one visible error is a malformed address (client-checkable
 * anyway, so not an oracle).
 */
export type RequestLinkResult = { ok: true } | { ok: false };

// Deliberately permissive: just enough to reject obvious non-emails. The real
// gate is the allowlist, not this shape check.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function requestSignInLink(
  emailRaw: string,
  locale: string,
): Promise<RequestLinkResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 320) {
    return { ok: false };
  }

  // Is this address invited? Read past RLS with the service role — the roster is
  // moderator-only and must never be exposed to the client. Fail CLOSED: if the
  // admin client is misconfigured we treat the address as not-invited (no send),
  // never accidentally opening signup.
  let invited = false;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("invited_emails")
      .select("email")
      .eq("email", email)
      .maybeSingle();
    invited = !error && data !== null;
  } catch (e) {
    console.error("invite gate: allowlist check failed (failing closed)", e);
    invited = false;
  }

  if (invited) {
    const origin = (await headers()).get("origin") ?? siteOrigin();
    const supabase = await createClient();
    // Only an allowlisted address reaches here, so shouldCreateUser is safe: the
    // account is created for an invited email or the member simply signs in.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/confirm?next=/protected`,
        shouldCreateUser: true,
        data: { locale },
      },
    });
    if (error) {
      // Log server-side, but still return the neutral result — a send failure
      // must not become a signal that this address IS on the list.
      console.error("invite gate: OTP send failed for an invited address", error);
    }
  }

  // Identical for invited and not — no oracle.
  return { ok: true };
}
