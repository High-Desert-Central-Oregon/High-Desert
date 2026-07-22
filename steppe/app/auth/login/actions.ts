"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
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

/**
 * Verify a typed 6-digit email code — the code half of the OTP path. The SAME
 * `signInWithOtp` send that delivers the magic link also mints this code (the
 * email template surfaces it as {{ .Token }}); redeeming it here signs the
 * member in WITHOUT ever leaving the page they're standing on. That is the
 * whole point: tapping the emailed link from Gmail or Proton opens the email
 * app's in-app webview, where the session cookies land uselessly (the member's
 * real browser never sees them) and the verify file picker is dead. The typed
 * code keeps the entire ceremony in the browser the member already has open.
 *
 * The session cookies are set on this action's response by the server client —
 * the same mechanism the /auth/confirm link route uses — then we redirect into
 * the app. Send-side posture is untouched: the invite gate and the
 * enforce_invited_signup DB backstop still decide who ever RECEIVES a code;
 * this only redeems one. A guess against a non-invited address fails exactly
 * like a wrong code (no enumeration oracle).
 *
 * Error split (honest about what GoTrue can tell us): GoTrue does NOT
 * distinguish a mistyped code from an expired one — both come back as
 * `otp_expired`, because a wrong code is simply "not a currently-valid token".
 * So: shape problems → "code-format" (checkable before any network);
 * `otp_expired` → "code-expired" (copy says "didn't match or has expired —
 * request a new one"); anything else → "code-failed".
 */
export type VerifyCodeResult =
  | { ok: false; error: "code-format" | "code-expired" | "code-failed" }
  | null;

export async function verifyEmailCode(
  emailRaw: string,
  codeRaw: string,
): Promise<VerifyCodeResult> {
  const email = emailRaw.trim().toLowerCase();
  // Be forgiving about how the code was typed ("123 456", "123-456"): keep the
  // digits only, then require exactly six of them.
  const code = codeRaw.replace(/\D/g, "");
  if (!EMAIL_RE.test(email) || email.length > 320 || code.length !== 6) {
    return { ok: false, error: "code-format" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "email",
  });
  if (error) {
    return {
      ok: false,
      error: error.code === "otp_expired" ? "code-expired" : "code-failed",
    };
  }

  // Signed in — the cookies ride this response. Land in the app; the protected
  // layout routes an unconsented first-timer on to /welcome as usual.
  redirect("/protected");
}
