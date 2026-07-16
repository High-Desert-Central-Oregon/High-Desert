import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/db";

export type CurrentUser = { id: string; email: string | null };

/**
 * The signed-in user, or null. Wraps `getClaims()` so the rest of the app has a
 * single, small way to ask "who is this?" without re-deriving the shape of a JWT.
 * Reads cookies — render inside a `<Suspense>` boundary.
 *
 * Wrapped in React `cache()` so it runs at most ONCE per request (perf-audit-v2
 * F4): on a single /protected navigation the layout guard, the nav bar, and the
 * page each ask "who is this?", and this collapses those into one `getClaims`.
 * `cache()` is request-scoped and reset on every request, and `getClaims`
 * verifies the immutable incoming-request cookie, so the memo is transparent —
 * it introduces no cross-request staleness.
 */
export const getCurrentUser = cache(
  async (): Promise<CurrentUser | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims?.sub) return null;
    return { id: data.claims.sub, email: data.claims.email ?? null };
  },
);

/**
 * The signed-in member's profile row, or null if not signed in. The profile is
 * created by the database on sign-up (`handle_new_user` trigger), so this only
 * ever reads — bootstrap is the server's job, never the client's (invariant 2).
 */
export async function getMyProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("profiles")
    .select(
      "id, display_name, neighborhood_id, neighborhood_visibility, verified, role, tenure_start, locale, created_at",
    )
    .eq("id", userId)
    .maybeSingle<Profile>();

  return data ?? null;
}

/**
 * Whether the signed-in member is a moderator or admin. A convenience check for
 * gating reviewer UI and guarding server actions before they touch privileged
 * operations. The database is still the real authority: `decide_verification`
 * and the storage read policy both re-check `is_moderator()` server-side, so a
 * forged client can never get past them even if this returned the wrong answer.
 */
export async function isModerator(): Promise<boolean> {
  const profile = await getMyProfile();
  return profile?.role === "moderator" || profile?.role === "admin";
}
