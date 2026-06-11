import { createClient } from "@supabase/supabase-js";

/**
 * Service-role ("secret key") Supabase client that BYPASSES Row-Level Security.
 *
 * Use ONLY inside a server action that has itself already verified the caller's
 * authority, and ONLY for an operation RLS cannot express. In this build that is
 * exactly two things:
 *   1. deleting a member's verification-evidence object from storage when a
 *      moderator decides — the DB drops the pointer, this client drops the file,
 *      together completing "verify, then forget" (CLAUDE.md invariant 1). There
 *      is deliberately no member/moderator DELETE policy on the bucket.
 *   2. on account deletion, scrubbing the guarded profile trust fields and
 *      anonymising + banning the auth identity — the parts the member's own
 *      session and the self-edit guard can't reach. We never hard-delete the
 *      auth user (that would cascade the profile and the preserved votes).
 *
 * Never import this into client code, and never expose the secret key
 * (`SUPABASE_SERVICE_ROLE_KEY` is server-only — not `NEXT_PUBLIC_*`).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) {
    throw new Error(
      "Admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
