import { createClient } from "@supabase/supabase-js";

/**
 * Service-role ("secret key") Supabase client that BYPASSES Row-Level Security.
 *
 * Use ONLY inside a server action that has itself already verified the caller's
 * authority, and ONLY for an operation RLS cannot express. In this build that is
 * exactly one thing: deleting a member's verification-evidence object from
 * storage when a moderator makes a decision. There is deliberately no
 * member/moderator DELETE policy on the bucket — the database drops the pointer,
 * this client drops the file, and together they complete "verify, then forget"
 * (CLAUDE.md invariant 1).
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
